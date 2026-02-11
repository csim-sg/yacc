/**
 * Notification Types
 * Type definitions for notification creation and management
 */

/**
 * Notification Response DTO
 */
export interface NotificationResponse {
  id: string;
  userId: string;
  type: 'assignment' | 'mention';
  conversationId: string | null;
  actorId: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * List Notifications Response
 */
export interface ListNotificationsResponse {
  data: NotificationResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * Mark Notification Read Request
 */
export interface MarkNotificationReadRequest {
  isRead: boolean;
}

/**
 * Create Notification Internal Parameters
 */
export interface CreateNotificationParams {
  userId: string;
  type: 'assignment' | 'mention';
  conversationId: string | null;
  actorId: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Notification deduplication key
 */
export interface NotificationDeduplicationKey {
  userId: string;
  conversationId: string | null;
  type: 'assignment' | 'mention';
}
