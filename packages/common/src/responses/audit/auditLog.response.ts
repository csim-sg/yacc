import type { AuditLog } from '../../types/AuditLog.type';

/**
 * Audit Log Response
 * Response shape for audit log endpoints
 *
 * @see GET /api/audit/logs
 * @see GET /api/audit/conversations/:id/logs
 */
export interface AuditLogResponse {
  success: boolean;
  /** Array of audit log entries */
  data?: AuditLog[];
  /** Current page number */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Total items available */
  total?: number;
}
