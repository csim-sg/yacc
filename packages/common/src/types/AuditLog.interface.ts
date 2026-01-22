import type { Timestamp } from './Timestamp.interface';

/**
 * Audit Log Domain Type
 * Conversation-scoped only
 */
export interface AuditLog extends Omit<Timestamp, 'updatedAt'> {
  id: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entityType: 'conversation';
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}
