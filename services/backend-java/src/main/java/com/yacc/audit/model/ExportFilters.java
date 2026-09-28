package com.yacc.audit.model;

/**
 * Export filter subset (POC parity; frozen contract op
 * {@code exportAuditLogs}).
 *
 * @param actorId    filter by actor
 * @param action     filter by action
 * @param entityType filter by entity type
 * @param entityId   filter by entity id
 * @param dateFrom   ISO-8601 lower bound
 * @param dateTo     ISO-8601 upper bound
 */
public record ExportFilters(String actorId, String action, String entityType, String entityId,
        String dateFrom, String dateTo) {
}
