import { z } from 'zod';

export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid().optional(),
  actorName: z.string().optional(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  metadata: z.record(z.unknown()).optional(),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
