/**
 * useUnreadBadges Hook
 * Manages real-time unread badge updates via WebSocket
 *
 * Features:
 * - Tracks unread counts per conversation
 * - Updates in real-time on new messages
 * - Clears badge when conversation opened
 * - Persists unread state to cache
 * - Integrates with TanStack Query
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ConversationListItem } from '../services/conversations.service';
import { logger } from '../lib/logger';

/**
 * Hook to manage unread badge updates
 * Provides helper functions to update conversation unread counts in cache
 *
 * @returns Object with helper functions to manage unread badges
 *
 * @example
 * ```tsx
 * function InboxPage() {
 *   const { markAsRead } = useUnreadBadges();
 *
 *   const handleConversationClick = useCallback(
 *     (id: string) => {
 *       markAsRead(id);
 *       navigate(`/conversations/${id}`);
 *     },
 *     [markAsRead]
 *   );
 * }
 * ```
 */
export function useUnreadBadges() {
  const queryClient = useQueryClient();

  /**
   * Marks conversation as read
   * Updates cache immediately (optimistic)
   * Clears unread count
   */
  const markAsRead = useCallback(
    (conversationId: string) => {
      logger.debug('[UnreadBadges] Marking conversation as read', { conversationId });

      // Update conversation cache
      const cacheKey = ['conversations'];
      queryClient.setQueryData(cacheKey, (oldData: any) => {
        if (!oldData || !oldData.data) return oldData;

        return {
          ...oldData,
          data: oldData.data.map((conv: ConversationListItem) =>
            conv.id === conversationId ? { ...conv, unreadCount: 0 } : conv
          ),
        };
      });

      // TODO: Call API: PATCH /api/conversations/:id/markAsRead
      // try {
      //   await conversationsService.markAsRead(conversationId);
      // } catch (error) {
      //   logger.error('[UnreadBadges] Failed to mark as read', error);
      //   // Revert optimistic update on error
      //   queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // }
    },
    [queryClient]
  );

  /**
   * Updates unread count for a specific conversation
   * Called when new message arrives via WebSocket
   */
  const updateUnreadCount = useCallback(
    (conversationId: string, newCount: number) => {
      logger.debug('[UnreadBadges] Updating unread count', {
        conversationId,
        newCount,
      });

      const cacheKey = ['conversations'];
      queryClient.setQueryData(cacheKey, (oldData: any) => {
        if (!oldData || !oldData.data) return oldData;

        return {
          ...oldData,
          data: oldData.data.map((conv: ConversationListItem) =>
            conv.id === conversationId
              ? { ...conv, unreadCount: newCount }
              : conv
          ),
        };
      });
    },
    [queryClient]
  );

  /**
   * Increments unread count by 1
   * Called when new inbound message arrives
   */
  const incrementUnreadCount = useCallback(
    (conversationId: string) => {
      const cacheKey = ['conversations'];
      queryClient.setQueryData(cacheKey, (oldData: any) => {
        if (!oldData || !oldData.data) return oldData;

        return {
          ...oldData,
          data: oldData.data.map((conv: ConversationListItem) =>
            conv.id === conversationId
              ? { ...conv, unreadCount: (conv.unreadCount || 0) + 1 }
              : conv
          ),
        };
      });
    },
    [queryClient]
  );

  return {
    markAsRead,
    updateUnreadCount,
    incrementUnreadCount,
  };
}
