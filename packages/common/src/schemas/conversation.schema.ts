/**
 * Conversation Request Schemas
 *
 * Zod schemas for validating conversation-related requests.
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';
import { ChannelEnum, ConversationStatusEnum, PriorityEnum } from '../constants/statuses.constant.js';

/**
 * List conversations query parameters schema
 * Validates pagination and filter parameters for listing conversations
 */
export const ListConversationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  channel: ChannelEnum.optional(),
  status: ConversationStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  assignedUserId: z.string().uuid('Invalid user ID').optional(),
  tagId: z.string().uuid('Invalid tag ID').optional(),
  search: z.string().max(255).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  unread: z.coerce.boolean().optional(),
  sortBy: z.enum(['lastActivity', 'created', 'priority']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Inferred type for list conversations query
 */
export type ListConversationsQuery = z.infer<typeof ListConversationsQuerySchema>;

/**
 * Create conversation request body schema
 * Validates parameters for creating a new conversation
 */
export const CreateConversationRequestSchema = z.object({
  channel: ChannelEnum,
  externalThreadId: z.string().max(255).optional(),
  title: z.string().min(1).max(255).optional(),
});

/**
 * Inferred type for create conversation request
 */
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>;

/**
 * Update conversation request body schema
 * Validates parameters for updating a conversation
 */
export const UpdateConversationRequestSchema = z.object({
  status: ConversationStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  assignedUserId: z.string().uuid('Invalid user ID').optional().nullable(),
});

/**
 * Inferred type for update conversation request
 */
export type UpdateConversationRequest = z.infer<typeof UpdateConversationRequestSchema>;

/**
 * Update conversation status request body schema
 */
export const UpdateStatusRequestSchema = z.object({
  status: ConversationStatusEnum,
});

/**
 * Inferred type for update status request
 */
export type UpdateStatusRequest = z.infer<typeof UpdateStatusRequestSchema>;

/**
 * Update conversation priority request body schema
 */
export const UpdatePriorityRequestSchema = z.object({
  priority: PriorityEnum,
});

/**
 * Inferred type for update priority request
 */
export type UpdatePriorityRequest = z.infer<typeof UpdatePriorityRequestSchema>;

/**
 * Assign conversation request body schema
 */
export const AssignConversationRequestSchema = z.object({
  assignedUserId: z.string().uuid('Invalid user ID').nullable(),
});

/**
 * Inferred type for assign conversation request
 */
export type AssignConversationRequest = z.infer<typeof AssignConversationRequestSchema>;

/**
 * Bulk update conversations request body schema
 * Validates parameters for updating multiple conversations at once
 */
export const BulkUpdateConversationsRequestSchema = z.object({
  conversationIds: z.array(z.string().uuid('Invalid conversation ID')).min(1, 'At least one conversation ID is required').max(100, 'Maximum 100 conversation IDs allowed'),
  updates: z.object({
    status: ConversationStatusEnum.optional(),
    priority: PriorityEnum.optional(),
    assignedUserId: z.string().uuid('Invalid user ID').optional().nullable(),
  }),
});

/**
 * Inferred type for bulk update conversations request
 */
export type BulkUpdateConversationsRequest = z.infer<typeof BulkUpdateConversationsRequestSchema>;

/**
 * Bulk assign conversations request body schema
 */
export const BulkAssignConversationsRequestSchema = z.object({
  conversationIds: z.array(z.string().uuid('Invalid conversation ID')).min(1).max(100),
  assignedUserId: z.string().uuid('Invalid user ID').nullable(),
});

/**
 * Inferred type for bulk assign conversations request
 */
export type BulkAssignConversationsRequest = z.infer<typeof BulkAssignConversationsRequestSchema>;

/**
 * Search conversations query parameters schema
 */
export const SearchConversationsQuerySchema = z.object({
  q: z.string().min(1).max(255),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  channel: ChannelEnum.optional(),
  status: ConversationStatusEnum.optional(),
  priority: PriorityEnum.optional(),
});

/**
 * Inferred type for search conversations query
 */
export type SearchConversationsQuery = z.infer<typeof SearchConversationsQuerySchema>;
