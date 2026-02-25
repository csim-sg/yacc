/**
 * Message Request Schemas
 *
 * Zod schemas for validating message-related requests.
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';

/**
 * Send message request body schema
 * Validates parameters for sending a new message
 */
export const SendMessageRequestSchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  body: z.string().min(1, 'Message body is required').max(50000, 'Message body too long'),
  attachmentIds: z.array(z.string().uuid('Invalid attachment ID')).max(10, 'Maximum 10 attachments allowed').optional(),
});

/**
 * Inferred type for send message request
 */
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;

/**
 * List messages query parameters schema
 * Validates pagination and filter parameters for listing messages
 */
export const ListMessagesQuerySchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID'),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  before: z.string().datetime().optional(),
  after: z.string().datetime().optional(),
});

/**
 * Inferred type for list messages query
 */
export type ListMessagesQuery = z.infer<typeof ListMessagesQuerySchema>;

/**
 * Get messages query parameters schema
 * For filtering messages across conversations
 */
export const GetMessagesQuerySchema = z.object({
  conversationId: z.string().uuid('Invalid conversation ID').optional(),
  status: z.enum(['pending', 'sent', 'failed']).optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

/**
 * Inferred type for get messages query
 */
export type GetMessagesQuery = z.infer<typeof GetMessagesQuerySchema>;
