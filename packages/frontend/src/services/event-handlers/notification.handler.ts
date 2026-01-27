/**
 * Notification Event Handler
 *
 * Handles server events related to notifications:
 * - Notification received
 *
 * Updates Zustand store with new notifications
 * Invalidates notification queries
 */

import { useWebSocketStore } from '../../stores/websocket.store';
import { queryClient } from '../../lib/queryClient';
import type { NotificationReceivedEvent } from '../../types/websocket.types';
import { logger } from '../../lib/logger';

/**
 * Handle notification.received event
 * Adds notification to store and updates cache
 */
export function handleNotificationReceived(event: NotificationReceivedEvent): void {
  try {
    logger.debug('[NotificationHandler] Handling notification.received', {
      notificationId: event.notification.id,
      type: event.notification.type,
      conversationId: event.notification.conversationId,
    });

    // Check for duplicates
    const store = useWebSocketStore.getState();
    if (store.isEventProcessed(event.eventId)) {
      logger.warn('[NotificationHandler] Duplicate notification.received event ignored', {
        eventId: event.eventId,
      });
      return;
    }

    // Mark event as processed
    store.markEventProcessed(event.eventId);

    // Get current notifications from cache
    const notificationsData = queryClient.getQueryData<any[]>(['notifications']);

    if (notificationsData) {
      // Add new notification to beginning of list (most recent first)
      const updatedNotifications = [event.notification, ...notificationsData];

      // Keep only last 100 notifications
      if (updatedNotifications.length > 100) {
        updatedNotifications.pop();
      }

      // Update cache
      queryClient.setQueryData(['notifications'], updatedNotifications);
    } else {
      // Initialize notifications list if doesn't exist
      queryClient.setQueryData(['notifications'], [event.notification]);
    }

    // Invalidate notifications list query to trigger UI updates
    queryClient.invalidateQueries({
      queryKey: ['notifications'],
    });

    logger.info('[NotificationHandler] Notification received', {
      notificationId: event.notification.id,
      type: event.notification.type,
    });
  } catch (error) {
    logger.error('[NotificationHandler] Error handling notification.received', error);
  }
}
