/**
 * Presence Event Handler
 *
 * Handles server events related to user presence:
 * - Presence updated (online/offline/away)
 *
 * Updates Zustand store with user presence state
 * Tracks last activity time for away calculations
 */

import { useWebSocketStore } from '../../stores/websocket.store';
import type { PresenceUpdatedEvent } from '../../types/websocket.types';
import { logger } from '../../lib/logger';

/**
 * Handle presence.updated event
 * Updates user presence in store
 */
export function handlePresenceUpdated(event: PresenceUpdatedEvent): void {
  try {
    logger.debug('[PresenceHandler] Handling presence.updated', {
      userId: event.userId,
      userName: event.userName,
      status: event.status,
    });

    // Check for duplicates
    const store = useWebSocketStore.getState();
    if (store.isEventProcessed(event.eventId)) {
      logger.debug('[PresenceHandler] Duplicate presence.updated event ignored', {
        eventId: event.eventId,
      });
      return;
    }

    // Mark event as processed
    store.markEventProcessed(event.eventId);

    // Update presence in store
    store.setUserPresence(event.userId, event.status, event.lastSeen);

    logger.info('[PresenceHandler] User presence updated', {
      userId: event.userId,
      status: event.status,
    });
  } catch (error) {
    logger.error('[PresenceHandler] Error handling presence.updated', error);
  }
}

/**
 * Clear presence for user (called on logout)
 */
export function clearUserPresence(userId: string): void {
  try {
    logger.debug('[PresenceHandler] Clearing presence', { userId });
    
    const store = useWebSocketStore.getState();
    store.clearUserPresence(userId);
  } catch (error) {
    logger.error('[PresenceHandler] Error clearing presence', error);
  }
}
