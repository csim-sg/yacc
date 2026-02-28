/**
 * Audit Log Schemas
 *
 * Zod schemas for audit log entity and request validation.
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';

/**
 * Audit log entity schema
 * Conversation-scoped audit logs
 */
export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid().optional(),
  actorName: z.string().optional(),
  action: z.string(),
  entityType: z.enum(['conversation', 'message', 'user', 'tag', 'note', 'routing_rule', 'integration']),
  entityId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
  ipAddress: z.string().optional(),
  createdAt: z.coerce.date(),
});

/**
 * Inferred type for audit log entity
 */
export type AuditLog = z.infer<typeof AuditLogSchema>;

/**
 * List audit logs query parameters schema
 */
export const ListAuditLogsQuerySchema = z.object({
  actorId: z.string().uuid('Invalid actor ID').optional(),
  action: z.string().max(100).optional(),
  entityType: z.enum(['conversation', 'message', 'user', 'tag', 'note', 'routing_rule', 'integration']).optional(),
  entityId: z.string().uuid('Invalid entity ID').optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/**
 * Inferred type for list audit logs query
 */
export type ListAuditLogsQuery = z.infer<typeof ListAuditLogsQuerySchema>;

/**
 * Export audit logs request body schema
 */
export const ExportAuditLogsRequestSchema = z.object({
  format: z.enum(['csv', 'json']).optional().default('csv'),
  actorId: z.string().uuid('Invalid actor ID').optional(),
  action: z.string().max(100).optional(),
  entityType: z.enum(['conversation', 'message', 'user', 'tag', 'note', 'routing_rule', 'integration']).optional(),
  entityId: z.string().uuid('Invalid entity ID').optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

/**
 * Inferred type for export audit logs request
 */
export type ExportAuditLogsRequest = z.infer<typeof ExportAuditLogsRequestSchema>;
