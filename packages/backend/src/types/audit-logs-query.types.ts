/**
 * Audit Logs Query Types
 * 
 * Types for querying audit logs with filtering and pagination
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
  dateFrom?: Date | string;

  // Date range: to (inclusive)
  dateTo?: Date | string;

  // Pagination
  page?: number;
  limit?: number;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditLogQueryResponse {
  items: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AuditLogExportRequest {
  format?: 'csv' | 'json';
  filters?: AuditLogQueryFilters;
}

export interface AuditLogExportResponse {
  data: string; // CSV or JSON string
  format: 'csv' | 'json';
  timestamp: Date;
}
