package com.yacc.dlq.service;

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

import com.yacc.common.controller.NotFoundException;
import com.yacc.dlq.model.BulkRetryError;
import com.yacc.dlq.model.BulkRetryResult;
import com.yacc.dlq.model.DeadLetterQueueEntry;
import com.yacc.dlq.model.DlqPage;
import com.yacc.dlq.model.DlqStatistics;
import com.yacc.dlq.repository.DeadLetterQueueEntryRepository;

/**
 * Dead-letter-queue management over the DB DLQ table (ledger rows
 * REST-DLQ-001..004; ADR-028 — Redis/BullMQ removed; POC
 * {@code dlq.service} parity): paged listing with failure-reason filter,
 * reason statistics, re-queue marking, and ops-review removal. The Quartz
 * redelivery worker consumes the retried markers (MIG-063 scope).
 */
@Service
public class DlqService {

    private final DeadLetterQueueEntryRepository entries;

    public DlqService(DeadLetterQueueEntryRepository entries) {
        this.entries = entries;
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
}
