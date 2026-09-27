package com.yacc.audit.model;

import java.util.List;

/**
 * One audit-log page.
 *
 * @param items page items
 * @param total matching logs
 * @param page  1-indexed page
 * @param limit page size
 */
public record AuditPage(List<AuditLog> items, long total, int page, int limit) {

    /** Pages in the POC payload sense: ceil(total/limit), ≥1 when total>0. */
    public int pages() {
        return (int) Math.max(1, (total + limit() - 1) / limit());
    }
}
