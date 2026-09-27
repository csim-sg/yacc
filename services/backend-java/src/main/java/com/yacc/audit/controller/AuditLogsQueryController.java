package com.yacc.audit.controller;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.auth.model.AuthUser;
import com.yacc.audit.service.AuditLogsQueryService;
import com.yacc.common.model.BaseListResponse;
import com.yacc.audit.model.AuditLogResponse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

/**
 * Audit-log query/export wire surface (ledger rows REST-AUDITLOG-001..003;
 * frozen contract ops {@code queryAuditLogs}, {@code queryConversationAuditLogs},
 * {@code exportAuditLogs}): manager+ queries, admin+ export with the frozen
 * {@code Content-Disposition: attachment; filename="audit-logs-<iso>.<fmt>"}
 * download contract.
 */
@RestController
@RequestMapping("/api/audit-logs")
public class AuditLogsQueryController {

    private final AuditLogsQueryService audit;
    private final ObjectMapper mapper;

    public AuditLogsQueryController(AuditLogsQueryService audit, ObjectMapper mapper) {
        this.audit = audit;
        this.mapper = mapper;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public BaseListResponse<AuditLogResponse> query(
            @RequestParam(required = false) String actorId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit) {
        var result = audit.query(
                new AuditLogsQueryService.AuditFilters(actorId, action, entityType, entityId,
                        dateFrom, dateTo, page, limit));
        return BaseListResponse.of(
                result.items().stream().map(entry -> AuditLogResponse.from(entry, null, mapper)).toList(),
                result.page(), result.limit(), result.total());
    }

    @GetMapping("/conversations/{conversationId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public BaseListResponse<AuditLogResponse> queryConversation(
            @PathVariable("conversationId") java.util.UUID conversationId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit) {
        var result = audit.queryConversation(conversationId,
                new AuditLogsQueryService.AuditFilters(null, action, entityType, null,
                        dateFrom, dateTo, page, limit));
        return BaseListResponse.of(
                result.items().stream().map(entry -> AuditLogResponse.from(entry, null, mapper)).toList(),
                result.page(), result.limit(), result.total());
    }

    @PostMapping("/export")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public ResponseEntity<byte[]> export(@Valid @RequestBody ExportRequest request) {
        var filters = new AuditLogsQueryService.AuditFilters(
                request.filters() == null ? null : request.filters().actorId(),
                request.filters() == null ? null : request.filters().action(),
                request.filters() == null ? null : request.filters().entityType(),
                request.filters() == null ? null : request.filters().entityId(),
                request.filters() == null ? null : request.filters().dateFrom(),
                request.filters() == null ? null : request.filters().dateTo(),
                1, null);
        var export = audit.export(filters, request.format());
        MediaType contentType = "json".equals(export.format())
                ? MediaType.APPLICATION_JSON : MediaType.valueOf("text/csv");
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(export.filename()).build());
        return ResponseEntity.ok().contentType(contentType)
                .headers(headers).body(export.data().getBytes());
    }

    /**
     * Export body (frozen contract op {@code exportAuditLogs}).
     *
     * @param format csv | json
     * @param filters same filter fields as GET /api/audit-logs
     */
    public record ExportRequest(@jakarta.validation.constraints.NotNull @NotBlank String format,
            Filters filters) {

        /** Export filter subset (POC parity). */
        public record Filters(String actorId, String action, String entityType, String entityId,
                String dateFrom, String dateTo) {
        }
    }
}
