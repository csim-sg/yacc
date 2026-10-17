package com.yacc.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.common.controller.NotFoundException;
import com.yacc.api.dlq.BulkRetryError;
import com.yacc.api.dlq.BulkRetryResult;
import com.yacc.entity.DeadLetterQueueEntry;
import com.yacc.api.dlq.DlqPage;
import com.yacc.api.dlq.DlqStatistics;
import com.yacc.repository.DeadLetterQueueEntryRepository;

/**
 * Dead-letter-queue management over the DB DLQ table (ledger rows
 * REST-DLQ-001..004; ADR-028 — the POC's Redis/BullMQ queueing is removed;
 * POC {@code dlq.service} parity): paged listing with failure-reason filter,
 * reason statistics, entry creation (POC {@code moveToDLQ} parity), failed
 * redelivery-attempt recording, re-queue marking, ops-review removal, and
 * the enforced 7-day retention sweep. The retried markers are consumed by
 * the MIG-063 Quartz redelivery worker
 * ({@code com.yacc.api.queue.QueueRetryService}), which also drives the
 * durable claim/invocation protocol below (claim &rarr; invocation-start
 * &rarr; recorded outcome, with unstarted claims released — never
 * consumed).
 */
@Service
public class DlqService {

    /**
     * Redelivery-cycle lifecycle state stored in the entry's jsonb metadata
     * (the V1 {@code dead_letter_queue} schema is frozen — no new column).
     * The key set is worker-owned and never on the wire; callers of
     * {@code enqueue} must never set it. The frozen quantity is a
     * <em>delivery attempt</em> = one invocation of the delivery boundary,
     * so the protocol separates a claim from an invocation:
     *
     * <ul>
     *   <li>{@code retryCycle.attempt} — the last <em>claimed</em> attempt
     *       number (persisted <b>before</b> the delivery runs — "assigned,
     *       not started");</li>
     *   <li>{@code retryCycle.started} — the claimed invocation durably
     *       began (written as the last durable step immediately before the
     *       delivery call); from here its outcome is unknowable without a
     *       consumer ACK and recovery consumes the attempt conservatively;</li>
     *   <li>{@code retryCycle.failed} — the claimed attempt's failure
     *       outcome was recorded (a claim with neither this nor
     *       {@code started} is an interrupted assignment — released, never
     *       consumed);</li>
     *   <li>{@code retryCycle.exhausted} — the terminal
     *       {@code max_retries_exceeded} state.</li>
     * </ul>
     *
     * The once-only {@code retry_attempt} flag must stay {@code true} after
     * a manual retry (REST-MSG-003 P0 rule), so cycle state lives here
     * instead.
     */
    private static final String RETRY_CYCLE_METADATA_KEY = "retryCycle";
    private static final String RETRY_CYCLE_ATTEMPT_KEY = "attempt";
    private static final String RETRY_CYCLE_STARTED_KEY = "started";
    private static final String RETRY_CYCLE_FAILED_KEY = "failed";
    private static final String RETRY_CYCLE_EXHAUSTED_KEY = "exhausted";

    /** POC retention parity: DLQ entries expire 7 days after they move. */
    private static final int RETENTION_DAYS = 7;

    /**
     * Retention-sweep hygiene bounds (not contract values): at most
     * {@value #RETENTION_BATCH_SIZE} rows per bounded, independently
     * committed batch and at most {@value #RETENTION_SWEEP_MAX_ENTRIES}
     * rows per sweep call.
     */
    private static final int RETENTION_BATCH_SIZE = 200;
    private static final int RETENTION_SWEEP_MAX_ENTRIES = 10_000;

    private final DeadLetterQueueEntryRepository entries;
    private final ObjectMapper mapper;

    public DlqService(DeadLetterQueueEntryRepository entries, ObjectMapper mapper) {
        this.entries = entries;
        this.mapper = mapper;
    }

    /**
     * Creates a DLQ entry (POC {@code moveToDLQ} parity): 7-day retention,
     * explicit tracing fields, jsonb metadata. The frozen schema requires
     * real identities — {@code messageId}/{@code conversationId} must
     * reference persisted rows (FK enforcement is the fail-closed guard;
     * the POC's context-free placeholder-id insert violated exactly that FK
     * and was never replicated).
     */
    @Transactional
    public DeadLetterQueueEntry enqueue(UUID messageId, UUID conversationId, String payload,
            String failureReason, Integer totalAttempts, String lastError,
            String correlationId, String metadata) {
        DeadLetterQueueEntry entry = new DeadLetterQueueEntry(
                null,
                messageId,
                conversationId, payload, failureReason, totalAttempts, lastError,
                LocalDateTime.now().plusDays(RETENTION_DAYS));
        entry.setCorrelationId(correlationId);
        entry.setMetadata(metadata);
        // Flush at the boundary: the frozen FKs are the fail-closed guard for
        // context-free identities — the violation surfaces HERE, at the
        // enqueue call, never silently at commit.
        return entries.saveAndFlush(entry);
    }

    /**
     * Records one failed redelivery attempt (MIG-063 worker): refreshes
     * {@code last_error}/{@code total_attempts}/{@code updated_at} and
     * persists the cycle state — the attempt counter and the recorded-outcome
     * marker, plus, when the retry cycle is exhausted, the terminal marker.
     * The outcome state is canonical: {@code started} is dropped (the
     * recorded outcome supersedes it).
     */
    @Transactional
    public DeadLetterQueueEntry recordFailedAttempt(UUID id, String lastError,
            int cycleAttempt, boolean cycleExhausted) {
        DeadLetterQueueEntry entry = entries.findById(id)
                .orElseThrow(() -> new NotFoundException("DLQ entry not found"));
        entry.setLastError(lastError);
        entry.setTotalAttempts(
                (entry.getTotalAttempts() == null ? 0 : entry.getTotalAttempts()) + 1);
        ObjectNode cycle = metadataObject(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY);
        cycle.put(RETRY_CYCLE_ATTEMPT_KEY, cycleAttempt);
        cycle.put(RETRY_CYCLE_FAILED_KEY, true);
        cycle.remove(RETRY_CYCLE_STARTED_KEY);
        if (cycleExhausted) {
            cycle.put(RETRY_CYCLE_EXHAUSTED_KEY, true);
        }
        entry.setMetadata(mergeMetadata(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY, cycle));
        entry.setUpdatedAt(LocalDateTime.now());
        return entries.save(entry);
    }

    /**
     * Durably claims the next redelivery attempt <b>before</b> the delivery
     * runs (MIG-063 crash-safety protocol, T1) — "attempt N assigned, no
     * delivery begun". The claim is bookkeeping, <b>not</b> a consumed
     * attempt: the frozen quantity is a delivery attempt = one invocation
     * of the delivery boundary, so an interrupted claim never costs the
     * budget (it is released by {@link #releaseClaim}). Clears the previous
     * outcome and start markers so the freshly claimed attempt begins
     * unstarted.
     */
    @Transactional
    public DeadLetterQueueEntry claimAttempt(UUID id, int cycleAttempt) {
        DeadLetterQueueEntry entry = entries.findById(id)
                .orElseThrow(() -> new NotFoundException("DLQ entry not found"));
        ObjectNode cycle = metadataObject(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY);
        cycle.put(RETRY_CYCLE_ATTEMPT_KEY, cycleAttempt);
        cycle.remove(RETRY_CYCLE_FAILED_KEY);
        cycle.remove(RETRY_CYCLE_STARTED_KEY);
        entry.setMetadata(mergeMetadata(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY, cycle));
        entry.setUpdatedAt(LocalDateTime.now());
        return entries.save(entry);
    }

    /**
     * Marks the claimed attempt's invocation as durably started (MIG-063
     * crash-safety protocol, T2). This MUST be the last durable step
     * immediately before the delivery boundary is invoked — no I/O or other
     * work in between. From this commit the attempt is real: a crash after
     * it leaves the outcome unknowable (the frozen contract has no consumer
     * ACK), and recovery conservatively consumes the attempt — preserving
     * termination (a started attempt is never invoked again under its own
     * number) while the delivery itself may or may not have happened (the
     * documented duplicate window; the DLQ row is never deleted by that
     * path). A failure to persist the start leaves the claim without a
     * start — releaseable and re-delivered under the same attempt number.
     */
    @Transactional
    public DeadLetterQueueEntry markInvocationStarted(UUID id) {
        DeadLetterQueueEntry entry = entries.findById(id)
                .orElseThrow(() -> new NotFoundException("DLQ entry not found"));
        ObjectNode cycle = metadataObject(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY);
        cycle.put(RETRY_CYCLE_STARTED_KEY, true);
        entry.setMetadata(mergeMetadata(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY, cycle));
        entry.setUpdatedAt(LocalDateTime.now());
        return entries.save(entry);
    }

    /**
     * Releases an unstarted claim (MIG-063 crash-safety protocol, T5): the
     * attempt N was assigned but its invocation never began, so the durable
     * state rolls back to exactly where the previous attempt's recorded
     * outcome left it — {@code attempt = N-1} with that outcome marker
     * restored (attempt 1 releases to a clean {@code attempt = 0}). The
     * outcome marker is what keeps recovery idempotent: a released state
     * reads as "nothing in flight", so no settlement pass re-releases it
     * and the same attempt N is re-armed exactly once.
     *
     * <p>Must not touch {@code total_attempts}, {@code last_error}, the
     * once-only {@code retry_attempt} flag or any other column: a released
     * claim never consumed the budget. Releasing (instead of consuming) is
     * what keeps the cycle loss-free — the same attempt N is re-armed and
     * delivered.</p>
     */
    @Transactional
    public DeadLetterQueueEntry releaseClaim(UUID id) {
        DeadLetterQueueEntry entry = entries.findById(id)
                .orElseThrow(() -> new NotFoundException("DLQ entry not found"));
        ObjectNode cycle = metadataObject(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY);
        int released = Math.max(0, cycle.path(RETRY_CYCLE_ATTEMPT_KEY).asInt(0) - 1);
        cycle.put(RETRY_CYCLE_ATTEMPT_KEY, released);
        cycle.remove(RETRY_CYCLE_STARTED_KEY);
        if (released >= 1) {
            cycle.put(RETRY_CYCLE_FAILED_KEY, true);
        } else {
            cycle.remove(RETRY_CYCLE_FAILED_KEY);
        }
        entry.setMetadata(mergeMetadata(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY, cycle));
        return entries.save(entry);
    }

    /** All entries carrying a retried marker (worker consumption input). */
    @Transactional(readOnly = true)
    public List<DeadLetterQueueEntry> retriedEntries() {
        return entries.findByRetryAttemptTrue();
    }

    /**
     * True when the entry's redelivery cycle is exhausted (terminal metadata
     * marker) — the worker must never reschedule such an entry.
     */
    public boolean isRetryCycleExhausted(DeadLetterQueueEntry entry) {
        return metadataObject(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY)
                .path(RETRY_CYCLE_EXHAUSTED_KEY).asBoolean(false);
    }

    /**
     * The persisted attempt counter of the entry's redelivery cycle
     * (0 when no attempt has been claimed yet).
     */
    public int retryCycleAttempt(DeadLetterQueueEntry entry) {
        return metadataObject(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY)
                .path(RETRY_CYCLE_ATTEMPT_KEY).asInt(0);
    }

    /**
     * True when the claimed attempt's invocation durably began (the
     * invocation-start marker was written). With no recorded outcome this
     * reads as an interrupted invocation — conservatively consumed on
     * recovery; without it an unrecorded claim is released, never consumed.
     */
    public boolean isInvocationStarted(DeadLetterQueueEntry entry) {
        return metadataObject(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY)
                .path(RETRY_CYCLE_STARTED_KEY).asBoolean(false);
    }

    /**
     * True when the claimed attempt's failure outcome was recorded. A claim
     * with neither a recorded outcome nor a durably started invocation is an
     * interrupted <em>assignment</em> — the worker releases it (budget
     * untouched, same attempt re-armed); a started invocation without an
     * outcome is consumed as a counted, honestly recorded attempt.
     */
    public boolean isAttemptOutcomeRecorded(DeadLetterQueueEntry entry) {
        return metadataObject(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY)
                .path(RETRY_CYCLE_FAILED_KEY).asBoolean(false);
    }

    /** DLQ page ({@code {entries,total,page,limit}} shape). */
    @Transactional(readOnly = true)
    public DlqPage list(int page, int limit, String failureReason) {
        int safePage = Math.max(1, page);
        int safeLimit = Math.min(100, Math.max(1, limit));
        var result = (failureReason == null || failureReason.isBlank())
                ? entries.findAll(PageRequest.of(safePage - 1, safeLimit,
                        Sort.by(Sort.Direction.DESC, "movedAt")))
                : entries.findByFailureReason(failureReason,
                        PageRequest.of(safePage - 1, safeLimit,
                                Sort.by(Sort.Direction.DESC, "movedAt")));
        List<DeadLetterQueueEntry> items = result.getContent();
        return new DlqPage(items, result.getTotalElements(), safePage, safeLimit);
    }

    /** Statistics: total, per-reason counts, oldest/newest moved-at. */
    @Transactional(readOnly = true)
    public DlqStatistics stats() {
        List<DeadLetterQueueEntry> all = entries.findAll();
        Map<String, Long> byReason = new LinkedHashMap<>();
        LocalDateTime oldest = null;
        LocalDateTime newest = null;
        for (DeadLetterQueueEntry entry : all) {
            byReason.merge(entry.getFailureReason(), 1L, Long::sum);
            LocalDateTime movedAt = entry.getMovedAt();
            if (movedAt != null) {
                oldest = oldest == null || movedAt.isBefore(oldest) ? movedAt : oldest;
                newest = newest == null || movedAt.isAfter(newest) ? movedAt : newest;
            }
        }
        return new DlqStatistics(all.size(), byReason, oldest, newest);
    }

    /** Entry by id. */
    @Transactional(readOnly = true)
    public Optional<DeadLetterQueueEntry> findById(UUID id) {
        return entries.findById(id);
    }

    /** First entry for a message (manual-retry eligibility input). */
    @Transactional(readOnly = true)
    public Optional<DeadLetterQueueEntry> findByMessageId(UUID messageId) {
        return entries.findByMessageId(messageId);
    }

    /**
     * Marks the entry re-queued (retry marker + audit fields). When the
     * entry's retry cycle is terminal ({@code exhausted}), the terminal
     * cycle state is also cleared in the same transaction: the manual
     * re-queue is the only remaining recovery path for such an entry (the
     * P0 once-only flag permanently gates REST-MSG-003), and baseline
     * parity is a <b>fresh 3-attempt budget</b> (the POC re-enqueues with
     * {@code attempts = 3}). {@code retry_attempt} (P0),
     * {@code total_attempts}/{@code last_error} (row-lifetime accounting)
     * and every wire shape are untouched; a live (non-terminal) cycle is
     * left exactly as it is (idempotent with the previous behavior).
     */
    @Transactional
    public DeadLetterQueueEntry markRetried(UUID id, UUID retriedBy) {
        DeadLetterQueueEntry entry = entries.findById(id)
                .orElseThrow(() -> new NotFoundException("DLQ entry not found"));
        LocalDateTime now = LocalDateTime.now();
        entry.setRetryAttempt(true);
        entry.setRetriedAt(now);
        entry.setRetriedBy(retriedBy);
        if (isRetryCycleExhausted(entry)) {
            entry.setMetadata(removeMetadataKey(entry.getMetadata(),
                    RETRY_CYCLE_METADATA_KEY));
        }
        entry.setUpdatedAt(now);
        return entries.save(entry);
    }

    /** Removes the entry (ops review completed); false when absent. */
    @Transactional
    public boolean delete(UUID id) {
        if (!entries.existsById(id)) {
            return false;
        }
        entries.deleteById(id);
        return true;
    }

    /** Removes the entry for a message; false when absent. */
    @Transactional
    public boolean clearByMessageId(UUID messageId) {
        var entry = entries.findByMessageId(messageId);
        if (entry.isEmpty()) {
            return false;
        }
        entries.delete(entry.get());
        return true;
    }

    /** Marks every listed message's entry retried; reports per-id failures. */
    @Transactional
    public BulkRetryResult bulkRetry(List<UUID> messageIds, UUID retriedBy) {
        int successful = 0;
        List<BulkRetryError> errors = new ArrayList<>();
        for (UUID messageId : messageIds) {
            var entry = entries.findByMessageId(messageId);
            if (entry.isEmpty()) {
                errors.add(new BulkRetryError(messageId.toString(), "DLQ entry not found"));
                continue;
            }
            markRetried(entry.get().getId(), retriedBy);
            successful++;
        }
        return new BulkRetryResult(successful, messageIds.size() - successful, errors);
    }

    /** All entries for one failure reason (queue by-reason surface). */
    @Transactional(readOnly = true)
    public List<DeadLetterQueueEntry> byReason(String failureReason) {
        return entries.findByFailureReason(failureReason);
    }

    /**
     * Enforces the 7-day retention the enqueue writes (MIG-063; POC
     * {@code moveToDLQ} parity made real): removes expired entries in
     * bounded batches — at most {@value #RETENTION_BATCH_SIZE} rows per
     * batch, each batch a single atomic delete committed independently, at
     * most {@value #RETENTION_SWEEP_MAX_ENTRIES} rows per call — so the
     * sweep can never lock the table unboundedly. Returns the number of
     * removed entries. Entries whose {@code expires_at} is still in the
     * future are never touched.
     */
    public int removeExpiredEntries() {
        int removed = 0;
        while (removed < RETENTION_SWEEP_MAX_ENTRIES) {
            int batch = removeExpiredBatch();
            removed += batch;
            if (batch < RETENTION_BATCH_SIZE) {
                break;
            }
        }
        return removed;
    }

    /**
     * One bounded expired-entry batch (single atomic bulk delete committed
     * on its own; the oldest expirations go first).
     */
    public int removeExpiredBatch() {
        var expired = entries.findByExpiresAtBefore(LocalDateTime.now(),
                PageRequest.of(0, RETENTION_BATCH_SIZE, Sort.by(Sort.Direction.ASC,
                        "expiresAt")));
        if (expired.isEmpty()) {
            return 0;
        }
        entries.deleteAllInBatch(expired);
        return expired.size();
    }

    /**
     * Reads (or creates) one top-level object from the jsonb metadata
     * string. The DLQ metadata column is a documented JSON boundary (the
     * entity stores it as a raw jsonb string, ADR-027/ADR-030): malformed or
     * missing metadata reads as a fresh object, never as a failure.
     */
    private ObjectNode metadataObject(String metadata, String key) {
        if (metadata == null || metadata.isBlank()) {
            return mapper.createObjectNode();
        }
        try {
            JsonNode node = mapper.readTree(metadata).get(key);
            if (node instanceof ObjectNode object) {
                return object;
            }
        } catch (RuntimeException | com.fasterxml.jackson.core.JsonProcessingException malformed) {
            // unparseable metadata reads as absent — a fresh object replaces it
        }
        return mapper.createObjectNode();
    }

    /** Copies the metadata object and sets one top-level object value. */
    private String mergeMetadata(String metadata, String key, ObjectNode value) {
        ObjectNode node = mapper.createObjectNode();
        if (metadata != null && !metadata.isBlank()) {
            try {
                JsonNode existing = mapper.readTree(metadata);
                if (existing instanceof ObjectNode object) {
                    node = object;
                }
            } catch (RuntimeException | com.fasterxml.jackson.core.JsonProcessingException malformed) {
                // unparseable legacy metadata is replaced by the fresh object
            }
        }
        node.set(key, value);
        return node.toString();
    }

    /**
     * Copies the metadata object and removes one top-level key (other keys
     * are preserved); a missing key or unparseable metadata is returned
     * unchanged.
     */
    private String removeMetadataKey(String metadata, String key) {
        if (metadata == null || metadata.isBlank()) {
            return metadata;
        }
        try {
            JsonNode existing = mapper.readTree(metadata);
            if (existing instanceof ObjectNode object && object.has(key)) {
                object.remove(key);
                return object.toString();
            }
        } catch (RuntimeException | com.fasterxml.jackson.core.JsonProcessingException malformed) {
            // unparseable metadata carries no readable cycle state to clear
        }
        return metadata;
    }
}
