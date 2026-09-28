package com.yacc.audit.controller;

import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.audit.model.AuditFilters;
import com.yacc.audit.model.AuditLogResponse;
import com.yacc.audit.model.ConversationAuditResponse;
import com.yacc.audit.service.AuditLogsQueryService;

/**
 * Conversation-scoped audit wire surface (ledger row REST-AUDIT-001;
 * frozen contract op {@code getConversationAuditLogs}): manager+ only,
 * custom page shape {@code {items,total,page,limit,pages}} (NOT
 * BaseListResponse). Lives under {@code /api/conversations} per the frozen
 * path (controller-level declaration, no global prefix).
 */
@RestController
@RequestMapping("/api/conversations/{conversationId}/audit-logs")
public class ConversationAuditController {

    private final AuditLogsQueryService audit;
    private final ObjectMapper mapper;

    public ConversationAuditController(AuditLogsQueryService audit, ObjectMapper mapper) {
        this.audit = audit;
        this.mapper = mapper;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public ConversationAuditResponse getConversationAuditLogs(
            @PathVariable("conversationId") UUID conversationId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit) {
        var conversationPage = audit.queryConversation(conversationId,
                new AuditFilters(null, null, null, null, null, null,
                        page, limit));
        int safeLimit = conversationPage.limit();
        return new ConversationAuditResponse(
                conversationPage.items().stream()
                        .map(entry -> AuditLogResponse.from(entry, null, mapper))
                        .toList(),
                conversationPage.total(),
                conversationPage.page(),
                safeLimit,
                (int) Math.ceil(conversationPage.total() / (double) safeLimit));
    }
}
