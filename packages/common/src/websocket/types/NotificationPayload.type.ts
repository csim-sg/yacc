/**
 * Notification Payload Types
 *
 * Type definitions for notification-related WebSocket event payloads
 *
 * @module @yacc/common/websocket/types
 */

/** Notification type enum */
export type NotificationType = 'assignment' | 'mention' | 'system';

/**
 * Notification payload for WebSocket events
 *
 * Used for:
 * - notification.received: New notification for user
 * - notification.read: Notification marked as read
 * - notification.deleted: Notification removed
 */
export interface NotificationPayload {
  /** Unique notification identifier */
  id: string;

  /** User this notification is for */
  userId: string;

  /** Type of notification */
  type: NotificationType;

  /** Related conversation (if any) */
  conversationId: string;

  /** ID of user who triggered the notification */
  actorId: string;

  /** Display name of actor */
  actorName: string;

  /** Human-readable notification message */
  message: string;

  /** Whether notification has been read */
  isRead: boolean;

  /** ISO 8601 timestamp when notification was created */
  createdAt: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}
