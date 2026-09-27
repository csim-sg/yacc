package com.yacc.queue.controller;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.auth.model.AuthUser;
import com.yacc.queue.service.QueueService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * Queue wire surface (ledger rows REST-QUEUE-001..008; frozen contract ops
 * {@code getQueueStats}, {@code getQueueDlqEntries}, {@code retryQueuedMessage},
 * {@code bulkRetryDlq}, {@code getQueueDlqStats}, {@code getQueueJob},
 * {@code clearQueueDlqEntry}, {@code getQueueDlqByReason}): manager+
 * observability, super_admin-only clear. Re-expressed over the DB DLQ
 * (ADR-028); Quartz job identity 1:1 mapping lands with MIG-063.
 */
@RestController
public class QueueController {

    private final QueueService queue;

    public QueueController(QueueService queue) {
        this.queue = queue;
    }

    @GetMapping("/api/queue/stats")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public QueueService.QueueStatistics stats() {
        return queue.stats();
    }

    @GetMapping("/api/queue/dlq")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public QueueService.QueueDlqPage dlqEntries(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return queue.dlqEntries(page, pageSize);
    }

    @PostMapping("/api/queue/retry/{messageId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public QueueService.RetryResult retry(@PathVariable("messageId") UUID messageId,
            @AuthenticationPrincipal AuthUser principal) {
        return queue.retry(messageId, UUID.fromString(principal.getId()));
    }

    @PostMapping("/api/queue/dlq/retry")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public QueueService.BulkRetryResult bulkRetry(@Valid @RequestBody BulkRetryRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return queue.bulkRetry(request.messageIds(), UUID.fromString(principal.getId()));
    }

    @GetMapping("/api/queue/dlq/stats")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public QueueService.DlqStatsPayload dlqStats() {
        return queue.dlqStats();
    }

    @GetMapping("/api/queue/job/{jobId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public JobResponse job(@PathVariable("jobId") String jobId) {
        var job = queue.job(jobId)
                .orElseThrow(() -> new com.yacc.common.controller.NotFoundException("Job not found"));
        return new JobResponse(true, job);
    }

    @PostMapping("/api/queue/dlq/clear/{messageId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ClearResponse clear(@PathVariable("messageId") UUID messageId,
            @AuthenticationPrincipal AuthUser principal) {
        if (!queue.clear(messageId)) {
            throw new com.yacc.common.controller.NotFoundException("DLQ entry not found");
        }
        return new ClearResponse(true, messageId.toString(),
                "DLQ entry cleared and marked as processed", java.time.LocalDateTime.now());
    }

    @GetMapping("/api/queue/dlq/by-reason/{reason}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public QueueService.ReasonPage byReason(@PathVariable("reason") String reason) {
        return queue.byReason(reason);
    }

    /**
     * Job lookup envelope (POC parity: success flag + job + 404 body twin).
     *
     * @param success always true on the 200 path
     * @param job job details
     */
    public record JobResponse(boolean success, QueueService.JobDetails job) {
    }

    /**
     * Clear outcome (POC parity shape).
     *
     * @param success always true on the 200 path
     * @param messageId cleared message
     * @param message confirmation text
     * @param timestamp payload timestamp
     */
    public record ClearResponse(boolean success, String messageId, String message,
            java.time.LocalDateTime timestamp) {
    }

    /**
     * Bulk-retry body (frozen contract op {@code bulkRetryDlq}).
     *
     * @param messageIds target messages (POC cap 100)
     */
    public record BulkRetryRequest(
            @NotEmpty @Size(max = 100) List<UUID> messageIds) {
    }
}
