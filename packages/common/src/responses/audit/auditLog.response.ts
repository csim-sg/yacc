/**
 * Audit Log Response
 * Response shape for audit log endpoints
 */
export interface AuditLogResponse {
  success: boolean;
  data?: any[];
  page?: number;
  limit?: number;
  total?: number;
}
