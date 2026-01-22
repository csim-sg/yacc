import type { Timestamp } from './Timestamp.interface';

export interface AuditLog extends Timestamp {
  id: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}
