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
 * redelivery-attempt recording, re-queue marking, and ops-review removal.
 * The retried markers are consumed by the MIG-063 Quartz redelivery worker
 * ({@code com.yacc.api.queue.QueueRetryService}).
 */
@Service
public class DlqService {

    /**
     * Redelivery-cycle lifecycle state stored in the entry's jsonb metadata
     * (the V1 {@code dead_letter_queue} schema is frozen — no new column):
     * {@code retryCycle.attempt} is the last attempted attempt number and
     * {@code retryCycle.exhausted} marks the terminal
     * {@code max_retries_exceeded} state. The once-only {@code retry_attempt}
     * flag must stay {@code true} after a manual retry (REST-MSG-003 P0
     * rule), so cycle state lives here instead.
     */
    private static final String RETRY_CYCLE_METADATA_KEY = "retryCycle";
    private static final String RETRY_CYCLE_ATTEMPT_KEY = "attempt";
    private static final String RETRY_CYCLE_EXHAUSTED_KEY = "exhausted";

    /** POC retention parity: DLQ entries expire 7 days after they move. */
    private static final int RETENTION_DAYS = 7;

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
     * persists the cycle state — the attempt counter and, when the retry
     * cycle is exhausted, the terminal marker.
     */
    @Transactional
    public DeadLetterQueueEntry recordFailedAttempt(UUID id, String lastError,
            int totalAttempts, int cycleAttempt, boolean cycleExhausted) {
        DeadLetterQueueEntry entry = entries.findById(id)
                .orElseThrow(() -> new NotFoundException("DLQ entry not found"));
        entry.setLastError(lastError);
        entry.setTotalAttempts(totalAttempts);
        ObjectNode cycle = metadataObject(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY);
        cycle.put(RETRY_CYCLE_ATTEMPT_KEY, cycleAttempt);
        if (cycleExhausted) {
            cycle.put(RETRY_CYCLE_EXHAUSTED_KEY, true);
        }
        entry.setMetadata(mergeMetadata(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY, cycle));
        entry.setUpdatedAt(LocalDateTime.now());
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
     * (0 when no attempt has been recorded yet).
     */
    public int retryCycleAttempt(DeadLetterQueueEntry entry) {
        return metadataObject(entry.getMetadata(), RETRY_CYCLE_METADATA_KEY)
                .path(RETRY_CYCLE_ATTEMPT_KEY).asInt(0);
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

    /** Marks the entry re-queued (retry marker + audit fields). */
    @Transactional
    public DeadLetterQueueEntry markRetried(UUID id, UUID retriedBy) {
        DeadLetterQueueEntry entry = entries.findById(id)
                .orElseThrow(() -> new NotFoundException("DLQ entry not found"));
        LocalDateTime now = LocalDateTime.now();
        entry.setRetryAttempt(true);
        entry.setRetriedAt(now);
        entry.setRetriedBy(retriedBy);
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
}
