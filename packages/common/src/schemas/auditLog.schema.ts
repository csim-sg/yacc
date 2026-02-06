import { z } from 'zod';

/**
 * Audit Log Schema
 * Conversation-scoped only
 */
export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid().optional(),
  actorName: z.string().optional(),
  action: z.string(),
  entityType: z.literal('conversation'),
  entityId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  createdAt: z.string().datetime(),
});
