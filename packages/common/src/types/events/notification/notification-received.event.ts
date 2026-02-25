/**
 * Notification Received Event
 *
 * Fired when a user receives a new in-app notification (assignment, mention).
 *
 * @module @yacc/common/types/events/notification
 * @see .docs/02-api-and-data-model.md Section 6 - WebSocket Events
 */

import type { BaseEvent } from '../base.event';
import type { NotificationType } from '../../NotificationType.type';

/**
 * Minimal conversation preview for notification context
 */
export interface NotificationConversationPreview {
  /** UUID of the conversation */
  id: string;
  /** Channel type */
  channel: string;
  /** Preview of the latest message */
  latestMessage?: string;
  /** Name of the last sender */
  senderName?: string;
}

/**
 * Payload for notification.received event
 *
 * @example
 * ```json
 * {
 *   "notificationId": "550e8400-e29b-41d4-a716-446655440000",
 *   "userId": "660e8400-e29b-41d4-a716-446655440000",
 *   "type": "assignment",
 *   "conversationId": "770e8400-e29b-41d4-a716-446655440000",
 *   "actorId": "880e8400-e29b-41d4-a716-446655440000",
 *   "actorName": "John Doe",
 *   "message": "You have been assigned to a conversation",
 *   "conversationPreview": {
 *     "id": "770e8400-e29b-41d4-a716-446655440000",
 *     "channel": "telegram",
 *     "latestMessage": "Hello, I need help",
 *     "senderName": "Customer"
 *   },
 *   "timestamp": "2026-01-16T10:00:00Z"
 * }
 * ```
 */
export interface NotificationReceivedPayload {
  /** UUID of the notification */
  notificationId: string;
  /** UUID of the user receiving this notification */
  userId: string;
  /** Type of notification (assignment, mention) */
  type: NotificationType;
  /** UUID of the related conversation */
  conversationId: string;
  /** UUID of the user who triggered this notification */
  actorId: string;
  /** Display name of the actor (for UI display) */
  actorName: string;
  /** Human-readable notification message */
  message: string;
  /** Optional preview of the related conversation */
  conversationPreview?: NotificationConversationPreview;
  /** ISO8601 timestamp when the notification was created */
  timestamp: string;
}

/**
 * Notification Received Event
 *
 * Emitted when a user receives a new in-app notification.
 * In P0, only assignment notifications are sent; @mention notifications
 * are deferred to Phase 2.
 *
 * @example
 * ```typescript
 * // Type narrowing with discriminated union
 * if (event.event === 'notification.received') {
 *   const { notificationId, type, message, actorName } = event.payload;
 *   showToast(`${actorName}: ${message}`);
 *   incrementUnreadBadge();
 * }
 * ```
 */
export type NotificationReceivedEvent = BaseEvent<
  'notification.received',
  NotificationReceivedPayload
>;
