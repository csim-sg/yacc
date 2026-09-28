package com.yacc.audit.model;

/**
 * Query filters (frozen GET /api/audit-logs parameter set).
 *
 * @param actorId    filter by actor
 * @param action     filter by action
 * @param entityType filter by entity type
 * @param entityId   filter by entity id
 * @param dateFrom   ISO-8601 lower bound
 * @param dateTo     ISO-8601 upper bound
 * @param page       1-indexed page
 * @param limit      page size
 */
public record AuditFilters(String actorId, String action, String entityType, String entityId,
        String dateFrom, String dateTo, Integer page, Integer limit) {
}
