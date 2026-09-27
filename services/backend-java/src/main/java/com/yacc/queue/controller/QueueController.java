package com.yacc.queue.controller;

import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.auth.model.AuthUser;
import com.yacc.queue.model.BulkRetryRequest;
import com.yacc.queue.model.ClearResponse;
import com.yacc.queue.model.JobDetails;
import com.yacc.queue.model.JobResponse;
import com.yacc.queue.model.BulkRetryResult;
import com.yacc.queue.model.DlqStatsPayload;
import com.yacc.queue.model.QueueDlqPage;
import com.yacc.queue.model.QueueStatistics;
import com.yacc.queue.model.ReasonPage;
import com.yacc.queue.model.RetryResult;
import com.yacc.queue.service.QueueService;

import jakarta.validation.Valid;

/**
 * Queue wire surface (ledger rows REST-QUEUE-001..008; frozen contract ops
 * {@code getQueueStats}, {@code getQueueDlqEntries}, {@code retryQueuedMessage},
 * {@code bulkRetryDlq}, {@code getQueueDlqStats}, {@code getQueueJob},
 * {@code clearQueueDlqEntry}, {@code getQueueDlqByReason}): manager+
 * observability, super_admin-only clear. Re-expressed over the DB DLQ
 * (ADR-028); Quartz job identity 1:1 mapping lands with MIG-063.
 */
@RestController
@RequestMapping("/api/queue")
public class QueueController {

    private final QueueService queue;

    public QueueController(QueueService queue) {
        this.queue = queue;
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public QueueStatistics stats() {
        return queue.stats();
    }

    @GetMapping("/dlq")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public QueueDlqPage dlqEntries(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize) {
        return queue.dlqEntries(page, pageSize);
    }

    @PostMapping("/retry/{messageId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public RetryResult retry(@PathVariable("messageId") UUID messageId,
            @AuthenticationPrincipal AuthUser principal) {
        return queue.retry(messageId, UUID.fromString(principal.getId()));
    }

    @PostMapping("/dlq/retry")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public BulkRetryResult bulkRetry(@Valid @RequestBody BulkRetryRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return queue.bulkRetry(request.messageIds(), UUID.fromString(principal.getId()));
    }

    @GetMapping("/dlq/stats")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public DlqStatsPayload dlqStats() {
        return queue.dlqStats();
    }

    @GetMapping("/job/{jobId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public JobResponse job(@PathVariable("jobId") String jobId) {
        var job = queue.job(jobId)
                .orElseThrow(() -> new com.yacc.common.controller.NotFoundException("Job not found"));
        return new JobResponse(true, job);
    }

    @PostMapping("/dlq/clear/{messageId}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ClearResponse clear(@PathVariable("messageId") UUID messageId,
            @AuthenticationPrincipal AuthUser principal) {
        if (!queue.clear(messageId)) {
            throw new com.yacc.common.controller.NotFoundException("DLQ entry not found");
        }
        return new ClearResponse(true, messageId.toString(),
                "DLQ entry cleared and marked as processed", java.time.LocalDateTime.now());
    }

    @GetMapping("/dlq/by-reason/{reason}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public ReasonPage byReason(@PathVariable("reason") String reason) {
        return queue.byReason(reason);
    }
}
