/**
 * Common Path Parameter Schemas
 *
 * Reusable schemas for validating path parameters (e.g., /:id, /:conversationId)
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';

/**
 * UUID path parameter schema
 * Validates that an ID parameter is a valid UUID
 */
export const UuidParamsSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

/**
 * Inferred type for UUID params
 */
export type UuidParams = z.infer<typeof UuidParamsSchema>;

/**
 * Conversation path parameters schema
 * Validates conversation ID in path
 */
export const ConversationParamsSchema = z.object({
  id: z.string().uuid('Invalid conversation ID'),
});

/**
 * Inferred type for conversation params
 */
export type ConversationParams = z.infer<typeof ConversationParamsSchema>;

/**
 * Message path parameters schema
 * Validates message ID in path
 */
export const MessageParamsSchema = z.object({
  id: z.string().uuid('Invalid message ID'),
});

/**
 * Inferred type for message params
 */
export type MessageParams = z.infer<typeof MessageParamsSchema>;

/**
 * User path parameters schema
 * Validates user ID in path
 */
export const UserParamsSchema = z.object({
  id: z.string().uuid('Invalid user ID'),
});

/**
 * Inferred type for user params
 */
export type UserParams = z.infer<typeof UserParamsSchema>;

/**
 * Tag path parameters schema
 * Validates tag ID in path
 */
export const TagParamsSchema = z.object({
  id: z.string().uuid('Invalid tag ID'),
});

/**
 * Inferred type for tag params
 */
export type TagParams = z.infer<typeof TagParamsSchema>;

/**
 * Note path parameters schema
 * Validates note ID in path
 */
export const NoteParamsSchema = z.object({
  id: z.string().uuid('Invalid note ID'),
});

/**
 * Inferred type for note params
 */
export type NoteParams = z.infer<typeof NoteParamsSchema>;

/**
 * Notification path parameters schema
 * Validates notification ID in path
 */
export const NotificationParamsSchema = z.object({
  id: z.string().uuid('Invalid notification ID'),
});

/**
 * Inferred type for notification params
 */
export type NotificationParams = z.infer<typeof NotificationParamsSchema>;

/**
 * Routing rule path parameters schema
 * Validates routing rule ID in path
 */
export const RoutingRuleParamsSchema = z.object({
  id: z.string().uuid('Invalid routing rule ID'),
});

/**
 * Inferred type for routing rule params
 */
export type RoutingRuleParams = z.infer<typeof RoutingRuleParamsSchema>;

/**
 * Integration path parameters schema
 * Validates integration ID in path
 */
export const IntegrationParamsSchema = z.object({
  id: z.string().uuid('Invalid integration ID'),
});

/**
 * Inferred type for integration params
 */
export type IntegrationParams = z.infer<typeof IntegrationParamsSchema>;

/**
 * Attachment path parameters schema
 * Validates attachment ID in path
 */
export const AttachmentParamsSchema = z.object({
  id: z.string().uuid('Invalid attachment ID'),
});

/**
 * Inferred type for attachment params
 */
export type AttachmentParams = z.infer<typeof AttachmentParamsSchema>;

/**
 * IRC Profile path parameters schema
 * Validates IRC profile ID in path
 */
export const IrcProfileParamsSchema = z.object({
  id: z.string().uuid('Invalid IRC profile ID'),
});

/**
 * Inferred type for IRC profile params
 */
export type IrcProfileParams = z.infer<typeof IrcProfileParamsSchema>;
