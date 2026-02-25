/**
 * Notification Event Types
 *
 * WebSocket events related to user notifications:
 * - notification.received: User receives a new notification (assignment, mention)
 *
 * @module @yacc/common/types/events/notification
 */

export type {
  NotificationReceivedEvent,
  NotificationReceivedPayload,
  NotificationConversationPreview,
} from './notification-received.event';
