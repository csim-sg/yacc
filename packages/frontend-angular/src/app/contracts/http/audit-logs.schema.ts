import { z } from 'zod';
import { baseListResponseSchema } from '../common/envelope.schema';

/**
 * Audit-logs contract family (T3 §4.2 — live controllers, manager+).
 *
 * Wire irregularities encoded 1:1 (see `contracts/manifest.md`): both
 * query endpoints answer the standard `BaseListResponse` wire shape
 * `{ data, page, limit, total }`. The React service types claim
 * `{ items, total, page, limit, pages }` (global query) and
 * `{ success, data, pagination }` (conversation query) — recorded
 * DTO-claim drift rows; wire truth encoded here.
 */

/** Wire audit-log row. */
export const AuditLogSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

/** GET /api/audit-logs — query params. */
export const ListAuditLogsParamsSchema = z.object({
  actorId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type ListAuditLogsParams = z.infer<typeof ListAuditLogsParamsSchema>;

/** GET /api/audit-logs — `BaseListResponse` wire shape (drift note above). */
export const ListAuditLogsResponseSchema = baseListResponseSchema(AuditLogSchema);

export type ListAuditLogsResponse = z.infer<typeof ListAuditLogsResponseSchema>;

/** GET /api/audit-logs/conversations/:conversationId — query params. */
export const ListConversationAuditLogsParamsSchema = z.object({
  action: z.string().optional(),
  entityType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().optional(),
  limit: z.number().int().optional(),
});

export type ListConversationAuditLogsParams = z.infer<
  typeof ListConversationAuditLogsParamsSchema
>;

/** Conversation-scoped query — same `BaseListResponse` wire shape. */
export const ListConversationAuditLogsResponseSchema = baseListResponseSchema(AuditLogSchema);

export type ListConversationAuditLogsResponse = z.infer<
  typeof ListConversationAuditLogsResponseSchema
>;

/**
 * POST /api/audit-logs/export (admin+) — request body. The response is a
 * binary blob (CSV/JSON content, not JSON) — transport-level concern of
 * the HTTP seam (`responseType: 'blob'`), not a JSON schema.
 */
export const ExportAuditLogsRequestSchema = z.object({
  format: z.enum(['csv', 'json']).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

export type ExportAuditLogsRequest = z.infer<typeof ExportAuditLogsRequestSchema>;
