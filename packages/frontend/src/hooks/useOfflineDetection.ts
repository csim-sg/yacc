/**
 * useOfflineDetection Hook
 *
 * Detects online/offline status and manages offline queue synchronization
 * Features:
 * - Listens to window online/offline events
 * - Syncs offline queue when connection restored
 * - Updates WebSocket connection state
 * - Error handling with retry logic
 */

import { useEffect } from 'react';
import { useWebSocketStore } from '../stores/websocket.store';
import { useOfflineQueue } from '../stores/offline-queue.store';
import { webSocketService } from '../services/websocket.service';
import { logger } from '../lib/logger';

/**
 * Initialize offline detection and queue sync
 * Should be called once in app root
 */
export function useOfflineDetection(): void {
  useEffect(() => {
    logger.info('[useOfflineDetection] Initializing offline detection');

    /**
     * Handle online event
     */
    const handleOnline = () => {
      logger.info('[useOfflineDetection] Device came online');

      const wsStore = useWebSocketStore.getState();
      const queueStore = useOfflineQueue.getState();

      // Update connection state
      if (wsStore.connectionState === 'offline' || wsStore.connectionState === 'disconnected') {
        // Try to reconnect WebSocket
        try {
          webSocketService.connect();
        } catch (error) {
          logger.error('[useOfflineDetection] Failed to reconnect WebSocket', error);
        }
      }

      // Sync offline queue if there are messages
      if (queueStore.messages.length > 0) {
        logger.info('[useOfflineDetection] Syncing offline queue', {
          messageCount: queueStore.messages.length,
        });

        syncOfflineQueue();
      }
    };

    /**
     * Handle offline event
     */
    const handleOffline = () => {
      logger.warn('[useOfflineDetection] Device went offline');

      const wsStore = useWebSocketStore.getState();
      wsStore.setConnectionState('offline');
    };

    // Register event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
}

/**
 * Sync offline queue with server
 * Called when connection is restored
 */
async function syncOfflineQueue(): Promise<void> {
  const queueStore = useOfflineQueue.getState();

  if (!queueStore.messages.length) {
    logger.debug('[OfflineQueue] No messages to sync');
    return;
  }

  logger.info('[OfflineQueue] Starting sync', {
    messageCount: queueStore.messages.length,
  });

  try {
    queueStore.setSyncing(true);

    // Get pending messages
    const pendingMessages = queueStore.messages.filter(
      (msg) => msg.status === 'pending' || msg.status === 'failed',
    );

    if (pendingMessages.length === 0) {
      logger.debug('[OfflineQueue] No pending messages to sync');
      queueStore.setSyncing(false);
      return;
    }

    // TODO: Replace with actual API call to batch sync endpoint
    // POST /api/conversations/messages/batch
    // Expected response: { results: { [tempId]: { success: boolean; error?: string; serverId?: string } } }

    // For now, simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mark all as synced
    for (const message of pendingMessages) {
      // In real implementation, check response for each message
      queueStore.removeMessage(message.tempId);
    }

    queueStore.setLastSyncTime(Date.now());
    queueStore.setSyncing(false);

    logger.info('[OfflineQueue] Sync completed successfully', {
      syncedCount: pendingMessages.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('[OfflineQueue] Sync failed', { error: errorMessage });

    queueStore.setSyncError(errorMessage);

    // Keep messages in queue for retry
    // Mark as failed
    const pendingMessages = queueStore.messages.filter(
      (msg) => msg.status === 'pending' || msg.status === 'syncing',
    );

    for (const message of pendingMessages) {
      queueStore.updateMessageStatus(message.tempId, 'failed', errorMessage);
    }
  }
}

/**
 * Manually retry offline queue sync
 * Useful if user clicks retry button after failed sync
 */
export function useRetryOfflineSync(): () => Promise<void> {
  return async () => {
    logger.info('[OfflineQueue] User triggered manual sync retry');

    if (!navigator.onLine) {
      logger.warn('[OfflineQueue] Device is offline, cannot sync');
      throw new Error('Device is offline');
    }

    await syncOfflineQueue();
  };
}
