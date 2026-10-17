package com.yacc.api.queue;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.service.DlqService;
import com.yacc.entity.MessageStatus;
import com.yacc.api.message.MessageQueryService;
import com.yacc.api.queue.BulkRetryResult;
import com.yacc.api.queue.DlqStats;
import com.yacc.api.queue.DlqStatsPayload;
import com.yacc.api.queue.JobDetails;
import com.yacc.api.queue.JobOptions;
import com.yacc.api.queue.PatternAnalysis;
import com.yacc.api.queue.QueueDlqEntryRow;
import com.yacc.api.queue.QueueDlqPage;
import com.yacc.api.queue.QueueStatistics;
import com.yacc.api.queue.ReasonCount;
import com.yacc.api.queue.ReasonPage;
import com.yacc.api.queue.RetryResult;

/**
 * Queue observability re-expressed over the DB DLQ + message lifecycle
 * (ledger rows REST-QUEUE-001..008; ADR-028 — the POC's Redis/BullMQ
 * queueing is removed; POC {@code queue.controller} wire shapes preserved).
 * The MIG-063 Quartz redelivery worker
 * ({@code com.yacc.api.queue.QueueRetryService}) supplies the async
 * behavior: the opaque {@code jobId} maps 1:1 onto the Quartz job key
 * (messageId string; canonicalization §5 Note 5 — lookup resolves the DLQ
 * entry by messageId, else entry id) and {@code state} preserves the
 * baseline vocabulary through the MIG-063 Quartz mapping.
 */
@Service
public class QueueService {

    private final DlqService dlq;
    private final MessageQueryService messages;
    private final QueueRetryService retries;

    public QueueService(DlqService dlq, MessageQueryService messages,
            QueueRetryService retries) {
        this.dlq = dlq;
        this.messages = messages;
        this.retries = retries;
    }

    /** Queue statistics + timestamp (BullMQ vocabulary, DB-derived). */
    @Transactional(readOnly = true)
    public QueueStatistics stats() {
        long pending = messages.countByStatus(MessageStatus.PENDING);
        long failed = messages.countByStatus(MessageStatus.FAILED);
        long sent = messages.countByStatus(MessageStatus.SENT);
        long dlqCount = dlq.stats().total();
        return new QueueStatistics(0, pending, sent, failed, 0, dlqCount,
                pending + sent + failed + dlqCount, LocalDateTime.now());
    }

    /** DLQ entries page (queue-surface payload mapping). */
    @Transactional(readOnly = true)
    public QueueDlqPage dlqEntries(int page, int pageSize) {
        int safePage = Math.max(1, page);
        int safeSize = Math.max(1, pageSize);
        var result = dlq.list(safePage, safeSize, null);
        List<QueueDlqEntryRow> items = result.entries().stream().map(QueueService::entryRow)
                .toList();
        return new QueueDlqPage(items, result.total(), safePage, safeSize, LocalDateTime.now());
    }

    /** Retries one DLQ entry by message id (manager+ mutation). */
    @Transactional
    public RetryResult retry(UUID messageId, UUID actorId) {
        var entry = dlq.findByMessageId(messageId)
                .orElseThrow(() -> new com.yacc.common.controller.NotFoundException(
                        "DLQ entry not found for message: " + messageId));
        dlq.markRetried(entry.getId(), actorId);
        return new RetryResult(true, messageId.toString(),
                "Message re-enqueued for delivery", LocalDateTime.now());
    }

    /** Bulk retry by message ids. */
    @Transactional
    public BulkRetryResult bulkRetry(List<UUID> messageIds, UUID actorId) {
        var result = dlq.bulkRetry(messageIds, actorId);
        return new BulkRetryResult(result.successful(), result.failed(), result.errors(),
                LocalDateTime.now());
    }

    /** DLQ statistics + pattern analysis (POC {stats, analysis} payload). */
    @Transactional(readOnly = true)
    public DlqStatsPayload dlqStats() {
        var stats = dlq.stats();
        List<Map.Entry<String, Long>> top = stats.byFailureReason().entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(5)
                .toList();
        return new DlqStatsPayload(new DlqStats(stats.total(), stats.byFailureReason(),
                stats.oldest(), stats.newest()), new PatternAnalysis(
                top.stream().map(entry -> new ReasonCount(entry.getKey(), entry.getValue())).toList(),
                0, null, 0), LocalDateTime.now());
    }

    /**
     * Job lookup by opaque id (messageId first, then DLQ entry id). The
     * state is the MIG-063 Quartz mapping of the live cycle over the
     * baseline vocabulary.
     */
    @Transactional(readOnly = true)
    public Optional<JobDetails> job(String jobId) {
        Optional<com.yacc.entity.DeadLetterQueueEntry> entry = Optional.empty();
        try {
            entry = dlq.findByMessageId(UUID.fromString(jobId));
        } catch (IllegalArgumentException ignored) {
            // not a UUID — fall through to entry-id lookup
        }
        if (entry.isEmpty()) {
            try {
                entry = dlq.findById(UUID.fromString(jobId));
            } catch (IllegalArgumentException ignored) {
                return Optional.empty();
            }
        }
        return entry.map(this::toJob);
    }

    /** Clears (removes) the DLQ entry for a message (super_admin mutation). */
    @Transactional
    public boolean clear(UUID messageId) {
        return dlq.clearByMessageId(messageId);
    }

    /** DLQ entries filtered by failure reason. */
    @Transactional(readOnly = true)
    public ReasonPage byReason(String reason) {
        List<QueueDlqEntryRow> items = dlq.byReason(reason).stream()
                .map(QueueService::entryRow)
                .toList();
        return new ReasonPage(reason, items.size(), items, LocalDateTime.now());
    }

    private static QueueDlqEntryRow entryRow(com.yacc.entity.DeadLetterQueueEntry entry) {
        return new QueueDlqEntryRow(entry.getMessageId(), entry.getConversationId(),
                entry.getMovedAt(), entry.getFailureReason(), entry.getTotalAttempts(),
                entry.getLastError());
    }

    private JobDetails toJob(com.yacc.entity.DeadLetterQueueEntry entry) {
        return new JobDetails(entry.getMessageId().toString(), "outbound-message", entry.getPayload(),
                retries.jobState(entry.getMessageId()), 100, entry.getTotalAttempts(),
                new JobOptions(entry.getTotalAttempts(), "fixed"),
                entry.getLastError(), null, entry.getMovedAt(), entry.getMovedAt());
    }
}
