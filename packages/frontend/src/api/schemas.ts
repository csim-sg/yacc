/**
 * Zod Schemas for API Responses
 *
 * Type-safe runtime validation for all API responses
 * Provides both validation AND TypeScript type inference
 *
 * Key Benefits:
 * - Runtime validation (ensures API returns expected shape)
 * - Type inference via z.infer<> (eliminates manual type defs)
 * - Clear error messages if validation fails
 * - Single source of truth for API types
 *
 * Usage:
 * ```typescript
 * // Type inference
 * type Conversation = z.infer<typeof ConversationSchema>;
 *
 * // Validation
 * const conversation = ConversationSchema.parse(apiResponse);
 * ```
 */

import { z } from 'zod';

/**
 * User Schema
 * Represents authenticated user information
 */
export const UserSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
  email: z.string().email('Invalid email format'),
  name: z.string().nullable().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER']),
  status: z.enum(['active', 'disabled']).optional(),
  createdAt: z.string().datetime().transform((date) => new Date(date)),
});

export type User = z.infer<typeof UserSchema>;

/**
 * Sender Schema (subset of User for messages)
 * Lightweight version used in message objects
 */
export const SenderSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable().optional(),
});

export type Sender = z.infer<typeof SenderSchema>;

/**
 * Attachment Schema
 * File attachment on a message
 */
export const AttachmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(), // MIME type
  size: z.number().int().positive(),
  url: z.string().url('Invalid attachment URL'),
  storageKey: z.string().optional(), // R2 storage key
  uploadedAt: z.string().datetime().transform((date) => new Date(date)),
});

export type Attachment = z.infer<typeof AttachmentSchema>;

/**
 * Message Schema
 * Individual message in a conversation
 */
export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  sender: SenderSchema,
  senderId: z.string().uuid(),
  body: z.string().min(1, 'Message body cannot be empty'),
  status: z.enum(['pending', 'sent', 'failed']),
  direction: z.enum(['inbound', 'outbound']),
  attachments: z.array(AttachmentSchema).optional().default([]),
  createdAt: z.string().datetime().transform((date) => new Date(date)),
  updatedAt: z.string().datetime().transform((date) => new Date(date)),
});

export type Message = z.infer<typeof MessageSchema>;

/**
 * Conversation Schema
 * Main conversation (group/channel/DM)
 */
export const ConversationSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(['telegram', 'irc', 'whatsapp', 'wechat', 'meta', 'x']),
  externalThreadId: z.string(), // ID from external platform
  status: z.enum(['open', 'pending', 'resolved']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  title: z.string().optional(), // Group/channel name
  assignedUserId: z.string().uuid().nullable().optional(),
  assignedUser: UserSchema.nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  unreadCount: z.number().int().nonnegative().optional().default(0),
  lastMessage: MessageSchema.nullable().optional(),
  lastMessageAt: z.string().datetime().transform((date) => new Date(date)).nullable().optional(),
  createdAt: z.string().datetime().transform((date) => new Date(date)),
  updatedAt: z.string().datetime().transform((date) => new Date(date)),
  closedAt: z.string().datetime().transform((date) => new Date(date)).nullable().optional(),
  reopenedAt: z.string().datetime().transform((date) => new Date(date)).nullable().optional(),
});

export type Conversation = z.infer<typeof ConversationSchema>;

/**
 * Paginated Response Schema
 * Generic schema for paginated API responses
 *
 * Usage:
 * ```typescript
 * const ConversationsListSchema = PaginatedSchema(ConversationSchema);
 * ```
 */
export function PaginatedSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int().positive(),
      limit: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
      hasMore: z.boolean(),
    }),
  });
}

/**
 * Conversations List Response
 * GET /api/conversations (with pagination)
 */
export const ConversationsListSchema = PaginatedSchema(ConversationSchema);
export type ConversationsList = z.infer<typeof ConversationsListSchema>;

/**
 * Messages List Response
 * GET /api/conversations/:id/messages (with pagination)
 */
export const MessagesListSchema = PaginatedSchema(MessageSchema);
export type MessagesList = z.infer<typeof MessagesListSchema>;

/**
 * Error Response Schema
 * Standard error format from API
 */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string()).optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * API Response Envelope
 * Wraps successful API responses
 */
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    meta: z.object({
      requestId: z.string().optional(),
      timestamp: z.string().datetime().optional(),
    }).optional(),
  });

/**
 * Mutation Response Schemas
 */

/**
 * Send Message Response
 * POST /api/conversations/:id/messages
 */
export const SendMessageResponseSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  status: z.enum(['pending', 'sent', 'failed']),
  createdAt: z.string().datetime().transform((date) => new Date(date)),
});

export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;

/**
 * Update Conversation Status Response
 * PATCH /api/conversations/:id/status
 */
export const UpdateStatusResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['open', 'pending', 'resolved']),
  updatedAt: z.string().datetime().transform((date) => new Date(date)),
});

export type UpdateStatusResponse = z.infer<typeof UpdateStatusResponseSchema>;

/**
 * Assign Conversation Response
 * PATCH /api/conversations/:id/assign
 */
export const AssignConversationResponseSchema = z.object({
  id: z.string().uuid(),
  assignedUserId: z.string().uuid().nullable(),
  assignedUser: UserSchema.nullable().optional(),
  updatedAt: z.string().datetime().transform((date) => new Date(date)),
});

export type AssignConversationResponse = z.infer<typeof AssignConversationResponseSchema>;

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
    console.error(`[${context}] Validation Error:`, result.error.flatten());
    return null;
  }

  return result.data;
}
