package com.yacc.queue.service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.dlq.service.DlqService;
import com.yacc.message.model.MessageStatus;
import com.yacc.message.service.MessageQueryService;

/**
 * Queue observability re-expressed over the DB DLQ + message lifecycle
 * (ledger rows REST-QUEUE-001..008; ADR-028 — Redis/BullMQ removed; POC
 * {@code queue.controller} wire shapes preserved). The Quartz redelivery
 * worker and 1:1 Quartz job identity land with MIG-063; job lookup maps
 * the opaque {@code jobId} onto the DLQ entry (messageId, else entry id).
 */
@Service
public class QueueService {

    private final DlqService dlq;
    private final MessageQueryService messages;

    public QueueService(DlqService dlq, MessageQueryService messages) {
        this.dlq = dlq;
        this.messages = messages;
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
        List<Map<String, Object>> items = result.entries().stream().map(QueueService::entryRow)
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

    /** Job lookup by opaque id (messageId first, then DLQ entry id). */
    @Transactional(readOnly = true)
    public Optional<JobDetails> job(String jobId) {
        Optional<com.yacc.dlq.model.DeadLetterQueueEntry> entry = Optional.empty();
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
        return entry.map(QueueService::toJob);
    }

    /** Clears (removes) the DLQ entry for a message (super_admin mutation). */
    @Transactional
    public boolean clear(UUID messageId) {
        return dlq.clearByMessageId(messageId);
    }

    /** DLQ entries filtered by failure reason. */
    @Transactional(readOnly = true)
    public ReasonPage byReason(String reason) {
        List<Map<String, Object>> items = dlq.byReason(reason).stream()
                .map(QueueService::entryRow)
                .toList();
        return new ReasonPage(reason, items.size(), items, LocalDateTime.now());
    }

    private static Map<String, Object> entryRow(com.yacc.dlq.model.DeadLetterQueueEntry entry) {
        Map<String, Object> row = new LinkedHashMap<String, Object>();
        row.put("messageId", entry.getMessageId());
        row.put("conversationId", entry.getConversationId());
        row.put("failedAt", entry.getMovedAt());
        row.put("failureReason", entry.getFailureReason());
        row.put("totalAttempts", entry.getTotalAttempts());
        row.put("lastError", entry.getLastError());
        return row;
    }

    private static JobDetails toJob(com.yacc.dlq.model.DeadLetterQueueEntry entry) {
        return new JobDetails(entry.getMessageId().toString(), "outbound-message", entry.getPayload(),
                "failed", 100, entry.getTotalAttempts(),
                new JobOptions(entry.getTotalAttempts(), "fixed"),
                entry.getLastError(), null, entry.getMovedAt(), entry.getMovedAt());
    }

    /**
     * Queue statistics payload (BullMQ vocabulary, contract op
     * {@code getQueueStats} + timestamp, POC parity).
     */
    public record QueueStatistics(long active, long waiting, long completed, long failed, long delayed,
            long dlq, long totalJobs, LocalDateTime timestamp) {
    }

    /**
     * Queue DLQ page payload.
     *
     * @param entries row projections
     * @param total matching entries
     * @param page 1-indexed page
     * @param pageSize page size
     * @param timestamp payload timestamp
     */
    public record QueueDlqPage(List<Map<String, Object>> entries, long total, int page, int pageSize,
            LocalDateTime timestamp) {
    }

    /**
     * Retry outcome.
     *
     * @param success always true on the 200 path
     * @param messageId retried message
     * @param message confirmation text
     * @param timestamp payload timestamp
     */
    public record RetryResult(boolean success, String messageId, String message,
            LocalDateTime timestamp) {
    }

    /**
     * Bulk-retry outcome.
     *
     * @param successful retried entries
     * @param failed skipped entries
     * @param errors per-id failure reasons
     * @param timestamp payload timestamp
     */
    public record BulkRetryResult(int successful, int failed,
            List<DlqService.BulkRetryError> errors, LocalDateTime timestamp) {
    }

    /**
     * DLQ stats + analysis payload (contract op {@code getQueueDlqStats});
     * the stats block carries the POC {@code totalEntries} key names.
     */
    public record DlqStatsPayload(DlqStats stats, PatternAnalysis analysis,
            LocalDateTime timestamp) {
    }

    /**
     * Queue-surface DLQ statistics (POC {@code messageQueueDLQService} key
     * parity: totalEntries/byFailureReason/oldestEntry/newestEntry).
     */
    public record DlqStats(long totalEntries, Map<String, Long> byFailureReason,
            LocalDateTime oldestEntry, LocalDateTime newestEntry) {
    }

    /**
     * Failure-pattern analysis (POC {@code analyzeDLQPatterns} parity).
     */
    public record PatternAnalysis(List<ReasonCount> topFailureReasons, long avgAttemptsBeforeFailure,
            String mostCommonError, long conversationCount) {
    }

    /**
     * One failure-reason count.
     *
     * @param reason failure reason
     * @param count entries
     */
    public record ReasonCount(String reason, long count) {
    }

    /**
     * Job detail payload (frozen BullMQ-shaped response, DB re-expression).
     */
    public record JobDetails(String id, String name, String data, String state, int progress,
            int attemptsMade, JobOptions opts, String failedReason, List<String> stacktrace,
            LocalDateTime createdAt, LocalDateTime finishedAt) {
    }

    /**
     * Job retry options subset.
     *
     * @param attempts configured attempts
     * @param backoff backoff strategy label
     */
    public record JobOptions(Integer attempts, String backoff) {
    }

    /**
     * By-reason payload.
     *
     * @param failureReason queried reason
     * @param count entries
     * @param entries row projections
     * @param timestamp payload timestamp
     */
    public record ReasonPage(String failureReason, int count, List<Map<String, Object>> entries,
            LocalDateTime timestamp) {
    }
}
