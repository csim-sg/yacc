/**
 * Audit Logs Query Types
 * Backend-specific types for querying audit logs with filtering and pagination
 *
 * For shared types, use:
 * - AuditLog from '@yacc/common/types/AuditLog.type'
 * - AuditLogResponse from '@yacc/common/responses/audit/auditLog.response'
 * - ListAuditLogsRequest from '@yacc/common/requests/audit/listAuditLogs.request'
 */

/**
 * Audit Log Query Filters
 * @deprecated Use ListAuditLogsRequest from '@yacc/common/requests/audit/listAuditLogs.request'
 */
export interface AuditLogQueryFilters {
  // Filter by actor (user who performed action)
  actorId?: string;

  // Filter by action type (e.g., 'assign', 'tag', 'status_change')
  action?: string;

  // Filter by entity type (e.g., 'conversation', 'user', 'rule')
  entityType?: string;

  // Filter by specific entity ID
  entityId?: string;

  // Date range: from (inclusive)
  dateFrom?: string | Date;

  // Date range: to (inclusive)
  dateTo?: string | Date;

  // Pagination
  page?: number;
  limit?: number;
}

/**
 * Audit Log Entry
 * @deprecated Use AuditLog from '@yacc/common/types/AuditLog.type'
 */
export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Audit Log Query Response
 */
export interface AuditLogQueryResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Audit Log Export Request
 */
export interface AuditLogExportRequest {
  format?: 'csv' | 'json';
  filters?: AuditLogQueryFilters;
}

/**
 * Audit Log Export Response
 */
export interface AuditLogExportResponse {
  data: string; // CSV or JSON string
  format: 'csv' | 'json';
  timestamp: Date;
}
