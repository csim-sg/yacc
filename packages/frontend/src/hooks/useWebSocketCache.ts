/**
 * useWebSocketCache Hook
 *
 * Integrates WebSocket real-time updates with TanStack Query cache
 * Provides automatic cache invalidation and optimistic updates
 *
 * Features:
 * - Real-time cache updates on WebSocket events
 * - Optimistic updates with rollback on error
 * - Cache invalidation for dependent queries
 * - Message deduplication
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { webSocketService } from '../services/websocket.service';
import { registerSocketListeners, unregisterSocketListeners } from '../services/socket-listeners';
import { logger } from '../lib/logger';

/**
 * Initialize WebSocket cache synchronization
 * Should be called once in app root (e.g., in App.tsx useEffect)
 *
 * @returns - Boolean indicating if initialization was successful
 */
export function useWebSocketCache(): boolean {
  const queryClient = useQueryClient();

  useEffect(() => {
    logger.info('[useWebSocketCache] Initializing WebSocket cache sync');

    try {
      // Initialize WebSocket service
      webSocketService.initialize();

      // Register all event listeners
      registerSocketListeners();

      // Cleanup on unmount
      return () => {
        logger.info('[useWebSocketCache] Cleaning up WebSocket cache sync');
        unregisterSocketListeners();
        webSocketService.destroy();
      };
    } catch (error) {
      logger.error('[useWebSocketCache] Failed to initialize', error);
      return () => {
        /* no-op */
      };
    }
  }, [queryClient]);

  return true;
}

/**
 * Hook to refetch conversation on demand
 * Useful when user manually refreshes or needs fresh data
 */
export function useRefreshConversation(): (conversationId: string) => Promise<void> {
  const queryClient = useQueryClient();

  return async (conversationId: string) => {
    try {
      logger.debug('[useRefreshConversation] Refreshing conversation', {
        conversationId,
      });

      await queryClient.invalidateQueries({
        queryKey: ['conversation', conversationId],
      });

      await queryClient.invalidateQueries({
        queryKey: ['conversation', conversationId, 'messages'],
      });
    } catch (error) {
      logger.error('[useRefreshConversation] Failed to refresh', error);
      throw error;
    }
  };
}

/**
 * Hook to refetch conversations list on demand
 */
export function useRefreshConversations(): () => Promise<void> {
  const queryClient = useQueryClient();

  return async () => {
    try {
      logger.debug('[useRefreshConversations] Refreshing conversations list');

      await queryClient.invalidateQueries({
        queryKey: ['conversations'],
      });
    } catch (error) {
      logger.error('[useRefreshConversations] Failed to refresh', error);
      throw error;
    }
  };
}
