package com.yacc.audit.model;

import java.util.List;

/**
 * Frozen custom page shape (contract op {@code getConversationAuditLogs}).
 *
 * @param items page items
 * @param total matching entries
 * @param page  1-indexed page
 * @param limit page size
 * @param pages page count
 */
public record ConversationAuditResponse(List<AuditLogResponse> items,
        long total, int page, int limit, int pages) {
}
