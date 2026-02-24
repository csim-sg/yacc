/**
 * Notification Types
 * Backend-specific types for notification creation and management
 *
 * For shared types, use:
 * - Notification from '@yacc/common/types/notification.interface'
 * - NotificationResponse from '@yacc/common/responses/notifications/notification.response'
 * - MarkNotificationAsReadRequest from '@yacc/common/requests/notifications/markNotificationAsRead.request'
 */

/**
 * Notification Response DTO
 * @deprecated Use NotificationResponse from '@yacc/common/responses/notifications/notification.response'
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
 * List Notifications Response (service layer)
 * Service returns { data, total } - controller wraps in BaseListResponse
 */
export interface ListNotificationsServiceResponse {
  data: NotificationResponse[];
  total: number;
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
