/**
 * Audit Log Domain Type
 */

export interface AuditLog {
  id: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}
