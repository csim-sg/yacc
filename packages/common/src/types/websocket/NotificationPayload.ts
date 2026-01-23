/**
 * Notification Payloads
 *
 * WebSocket event payload types for notification-related events
 */

/**
 * Payload for notification.received event
 */
export interface NotificationReceivedPayload {
  notificationId: string;
  type: 'assignment' | 'mention';
  conversationId: string;
  message: string;
  actorId?: string;
  actorName?: string;
  createdAt: string;
}
