/**
 * Notification Events
 *
 * Notification-related WebSocket event types
 */

export const NOTIFICATION_RECEIVED = 'notification.received' as const;
export const NOTIFICATION_READ = 'notification.read' as const;
export const NOTIFICATION_DISMISSED = 'notification.dismissed' as const;

export const NotificationEvents = {
  NOTIFICATION_RECEIVED,
  NOTIFICATION_READ,
  NOTIFICATION_DISMISSED,
} as const;

export type NotificationEventType = typeof NotificationEvents[keyof typeof NotificationEvents];
