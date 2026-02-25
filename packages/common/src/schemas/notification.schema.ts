/**
 * Notification Schemas
 *
 * Zod schemas for notification entity and request validation.
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';
import { NotificationTypeEnum } from '../constants/statuses.constant.js';

/**
 * Notification entity schema
 * Represents a notification in the database
 */
export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: NotificationTypeEnum,
  conversationId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
  actorName: z.string().optional(),
  body: z.string(),
  isRead: z.boolean(),
  readAt: z.coerce.date().optional(),
  dismissedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Inferred type for notification entity
 */
export type Notification = z.infer<typeof NotificationSchema>;

/**
 * List notifications query parameters schema
 */
export const ListNotificationsQuerySchema = z.object({
  isRead: z.coerce.boolean().optional(),
  type: NotificationTypeEnum.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * Inferred type for list notifications query
 */
export type ListNotificationsQuery = z.infer<typeof ListNotificationsQuerySchema>;

/**
 * Mark notifications as read request body schema
 */
export const MarkNotificationsReadRequestSchema = z.object({
  notificationIds: z.array(z.string().uuid('Invalid notification ID')).min(1, 'At least one notification ID is required').max(100, 'Maximum 100 notification IDs allowed'),
});

/**
 * Inferred type for mark notifications read request
 */
export type MarkNotificationsReadRequest = z.infer<typeof MarkNotificationsReadRequestSchema>;

/**
 * Dismiss notification request body schema
 */
export const DismissNotificationRequestSchema = z.object({
  notificationId: z.string().uuid('Invalid notification ID'),
});

/**
 * Inferred type for dismiss notification request
 */
export type DismissNotificationRequest = z.infer<typeof DismissNotificationRequestSchema>;
