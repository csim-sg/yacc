/**
 * Frontend runtime contract layer (MIG-041; SPEC-002 AC-02/AC-07; ADR-023).
 *
 * Zod validators for API responses, each BOUND to the generated contract
 * types in `../api/contract/rest-api.gen.ts` (generated from the frozen
 * `.docs/migration/openapi.yaml`). The generated types are the single
 * contract source — this module adds runtime validation only and re-derives
 * no shape of its own, so wire-shape drift fails `pnpm type-check`.
 *
 * ADR-023 supersedes ADR-020: `@yacc/common` Zod is never imported here and
 * no hand-declared interface backs these schemas.
 */

import { z } from 'zod';
import { logger } from '../lib/logger';
import type { components } from './contract/rest-api.gen';

type Schemas = components['schemas'];

/**
 * User Schema — contract component `UserResponse`
 * (uuid id, lowercase role/status, ISO date-time strings).
 */
export const UserSchema: z.ZodType<Schemas['UserResponse']> = z.object({
  id: z.string().uuid('Invalid user ID format'),
  email: z.string().email('Invalid email format'),
  name: z.string(),
  role: z.enum(['super_admin', 'admin', 'manager', 'user']),
  status: z.enum(['active', 'inactive', 'suspended']),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
});

export type User = Schemas['UserResponse'];

/**
 * Message Schema — contract component `Message`
 * (`senderId`/`senderName`, nullable metadata, no client-side `sender`
 * object and no attachments member — the frozen contract is the shape).
 */
export const MessageSchema: z.ZodType<Schemas['Message']> = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().nullable(),
  senderName: z.string(),
  body: z.string(),
  status: z.enum(['pending', 'sent', 'failed']),
  direction: z.enum(['inbound', 'outbound']),
  externalMessageId: z.string().optional(),
  metadata: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Message = Schemas['Message'];

/**
 * Conversation Schema — contract component `Conversation`
 * (four canonical members, `additionalProperties: true` on the wire, so the
 * validator passes unknown members through instead of stripping them).
 */
export const ConversationSchema: z.ZodType<Schemas['Conversation']> = z
  .object({
    id: z.string().uuid().optional(),
    status: z.enum(['open', 'pending', 'resolved']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    assignedUserId: z.string().nullable().optional(),
  })
  .passthrough();

export type Conversation = Schemas['Conversation'];

/**
 * Paginated Response Schema — the frozen `BaseListResponse` envelope
 * `{data, page, limit, total}` (1-indexed page; REST-XSRV-001).
 *
 * Usage:
 * ```typescript
 * const ConversationsListSchema = PaginatedSchema(ConversationSchema);
 * ```
 */
export function PaginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
  });
}

/**
 * Conversations List Response
 * GET /api/conversations (BaseListResponse of Conversation)
 */
export const ConversationsListSchema = PaginatedSchema(ConversationSchema);
export type ConversationsList = z.infer<typeof ConversationsListSchema>;

/**
 * Messages List Response
 * GET /api/conversations/:id/messages — contract component
 * `MessageListResponse` (custom shape, deliberately NOT BaseListResponse).
 */
export const MessagesListSchema: z.ZodType<Schemas['MessageListResponse']> =
  z.object({
    messages: z.array(MessageSchema),
    total: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
  });

export type MessagesList = Schemas['MessageListResponse'];

/**
 * Mutation Response Schemas — each mirrors its frozen operation's 2xx
 * envelope (`{data: …}`).
 */

/**
 * Send Message Response
 * POST /api/conversations/:id/messages → 201 `{data: Message}`
 */
export const SendMessageResponseSchema = z.object({
  data: MessageSchema,
});

export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;

/**
 * Update Conversation Status Response
 * PATCH /api/conversations/:id/status → 200 `{data: Conversation}`
 */
export const UpdateStatusResponseSchema = z.object({
  data: ConversationSchema,
});

export type UpdateStatusResponse = z.infer<typeof UpdateStatusResponseSchema>;

/**
 * Assign Conversation Response
 * PATCH /api/conversations/:id/assign → 200 `{data: Conversation}`
 */
export const AssignConversationResponseSchema = z.object({
  data: ConversationSchema,
});

export type AssignConversationResponse = z.infer<
  typeof AssignConversationResponseSchema
>;

/**
 * Safe Parse Helpers
 *
 * Use these instead of .parse() to handle validation errors gracefully
 *
 * Usage:
 * ```typescript
 * const result = safeParse(ConversationSchema, apiResponse);
 * if (result.success) {
 *   console.log(result.data);
 * } else {
 *   console.error(result.error.flatten());
 * }
 * ```
 */

/**
 * Safe parse wrapper
 * Returns result with success flag instead of throwing
 */
export function safeParse<T extends z.ZodTypeAny>(schema: T, data: unknown) {
  return schema.safeParse(data);
}

/**
 * Parse with error logging
 * Logs validation errors for debugging
 */
export function parseWithLogging<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  context: string = 'API Response'
) {
  const result = schema.safeParse(data);

  if (!result.success) {
    logger.error(`[${context}] Validation Error`, result.error.flatten());
    return null;
  }

  return result.data;
}
