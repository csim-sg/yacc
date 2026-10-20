import { z } from 'zod';
import { dataEnvelopeSchema } from '../common/envelope.schema';

/**
 * Messages contract family (T3 §4.2 — live controllers).
 *
 * Wire irregularities encoded 1:1 (see `contracts/manifest.md`):
 * - `GET /api/conversations/:conversationId/messages` answers
 *   `{ messages, total, page, limit }` — NOT the `{ data, pageSize }`
 *   shape the React service type claims (DTO-claim drift row).
 * - `POST .../messages` answers `{ data: Message }` (201) — the FROZEN
 *   OpenAPI operation (`sendConversationMessage`, ADR-023/GOV-038) and
 *   the backend of record both answer the envelope; the earlier
 *   "raw message" local claim contradicted the frozen contract and is
 *   resolved to it in ANG-008 (U3 send-envelope disposition: the send
 *   path consumes the approved frozen-contract operation; the store's
 *   confirmed-append behavior is unchanged).
 * - `POST .../retry` answers `{ data }` (verified).
 */

/** Wire message row. */
export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().nullable().optional(),
  senderName: z.string(),
  body: z.string(),
  status: z.enum(['pending', 'sent', 'failed']),
  direction: z.enum(['inbound', 'outbound']),
  externalMessageId: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Message = z.infer<typeof MessageSchema>;

/**
 * GET /api/conversations/:conversationId/messages?page&limit — verified
 * wire shape (React service claims `{ data, page, pageSize, total }` —
 * recorded drift row; do not "fix" into new behavior).
 */
export const ListMessagesResponseSchema = z.object({
  messages: z.array(MessageSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});

export type ListMessagesResponse = z.infer<typeof ListMessagesResponseSchema>;

/** POST /api/conversations/:conversationId/messages — `{ body }`. */
export const SendMessageRequestSchema = z.object({
  body: z.string(),
});

export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

/**
 * POST response — the frozen `{ data: Message }` envelope (201), identical
 * to the retry envelope (frozen `sendConversationMessage` operation).
 */
export const SendMessageResponseSchema = dataEnvelopeSchema(MessageSchema);

export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;

/** POST .../messages/:messageId/retry — `{ data: message }` (verified). */
export const RetryMessageResponseSchema = dataEnvelopeSchema(MessageSchema);

export type RetryMessageResponse = z.infer<typeof RetryMessageResponseSchema>;

/**
 * GET .../messages/:messageId/status — raw `{ messageId, status, createdAt,
 * updatedAt }` (verified). API-only today — no live FE consumer (G8).
 */
export const GetMessageStatusResponseSchema = z.object({
  messageId: z.string().uuid(),
  status: z.enum(['pending', 'sent', 'failed']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type GetMessageStatusResponse = z.infer<typeof GetMessageStatusResponseSchema>;
