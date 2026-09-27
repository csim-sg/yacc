package com.yacc.dlq.controller;

import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.auth.model.AuthUser;
import com.yacc.common.controller.BadRequestException;
import com.yacc.common.controller.InternalServerErrorException;
import com.yacc.common.controller.NotFoundException;
import com.yacc.dlq.model.DlqEntryResponse;
import com.yacc.dlq.model.DlqListResponse;
import com.yacc.dlq.model.DlqStatistics;
import com.yacc.dlq.model.RemoveResponse;
import com.yacc.dlq.model.RemovedEntry;
import com.yacc.dlq.model.ReQueueResponse;
import com.yacc.dlq.service.DlqService;

/**
 * DLQ wire surface (ledger rows REST-DLQ-001..004; frozen contract ops
 * {@code listDlqEntries}, {@code getDlqStats}, {@code reQueueDlqEntry},
 * {@code removeDlqEntry}): manager+ read, admin+ re-queue,
 * super_admin-only removal.
 */
@RestController
@RequestMapping("/api/dlq")
public class DlqController {

    private final DlqService dlq;

    public DlqController(DlqService dlq) {
        this.dlq = dlq;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public DlqListResponse list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String failureReason) {
        int safePage = page == null ? 1 : page;
        int safeLimit = limit == null ? 25 : limit;
        if (safePage < 1 || safeLimit < 1 || safeLimit > 100) {
            throw new BadRequestException(
                    "Invalid pagination: page must be ≥1, limit must be 1-100");
        }
        var result = dlq.list(safePage, safeLimit, failureReason);
        return new DlqListResponse(
                result.entries().stream().map(DlqEntryResponse::from).toList(),
                result.total(), result.page(), result.limit());
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public DlqStatistics stats() {
        return dlq.stats();
    }

    @PostMapping("/{id}/re-queue")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public ReQueueResponse reQueue(@PathVariable("id") UUID id,
            @AuthenticationPrincipal AuthUser principal) {
        var entry = dlq.findById(id)
                .orElseThrow(() -> new NotFoundException("DLQ entry not found"));
        var updated = dlq.markRetried(entry.getId(), UUID.fromString(principal.getId()));
        return new ReQueueResponse("Entry marked for manual retry", DlqEntryResponse.from(updated));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public RemoveResponse remove(@PathVariable("id") UUID id) {
        var entry = dlq.findById(id)
                .orElseThrow(() -> new NotFoundException("DLQ entry not found"));
        if (!dlq.delete(entry.getId())) {
            throw new InternalServerErrorException("Failed to delete DLQ entry");
        }
        return new RemoveResponse("DLQ entry deleted successfully",
                new RemovedEntry(entry.getId().toString(), entry.getMessageId().toString(),
                        entry.getConversationId().toString(), entry.getFailureReason()));
    }
}
