package com.yacc.audit.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Export body (frozen contract op {@code exportAuditLogs}).
 *
 * @param format  csv | json
 * @param filters same filter fields as GET /api/audit-logs
 */
public record ExportRequest(@NotNull @NotBlank String format, ExportFilters filters) {
}
