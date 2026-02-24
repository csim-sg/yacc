import type { Notification } from '../../types/notification.interface';

/**
 * Notification Response
 * Response shape for notification endpoints
 *
 * @see GET /api/notifications
 * @see PATCH /api/notifications/:id
 */
export type NotificationResponse = Notification;
