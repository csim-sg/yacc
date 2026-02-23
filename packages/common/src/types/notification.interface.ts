import type { Timestamp } from './Timestamp.interface';
import type { NotificationType } from './NotificationType.type';

/**
 * Notification Entity
 * In-app notifications for user actions (assignments, mentions)
 *
 * @see GET /api/notifications - List user's notifications
 * @see PATCH /api/notifications/:id - Mark notification as read
 */
export interface Notification extends Timestamp {
  /** Unique identifier (UUID) */
  id: string;
  /** UUID of the user receiving this notification */
  userId: string;
  /** Type of notification (assignment, mention, unread) */
  type: NotificationType;
  /** UUID of the related conversation (null for system notifications) */
  conversationId: string | null;
  /** UUID of the user who triggered this notification */
  actorId?: string;
  /** Display name of the actor (for UI display) */
  actorName?: string;
  /** Human-readable notification message */
  body: string;
  /** Whether the notification has been read */
  isRead: boolean;
  /** ISO8601 timestamp when notification was read */
  readAt?: string;
  /** ISO8601 timestamp when notification was dismissed */
  dismissedAt?: string;
}
