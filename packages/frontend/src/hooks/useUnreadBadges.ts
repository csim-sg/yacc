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
     (conversationId: number | string) => {
       const id = typeof conversationId === 'string' ? parseInt(conversationId, 10) : conversationId;
       logger.debug('[UnreadBadges] Marking conversation as read', { conversationId: id });

       // Update conversation cache using prefix matching for all parameterized queries
       queryClient.setQueriesData(
         { queryKey: ['conversations'] },
         (oldData: unknown) => {
           const data = oldData as { data?: ConversationListItem[] } | undefined;
           if (!data || !data.data) return oldData;

           return {
             ...data,
             data: data.data.map((conv: ConversationListItem) =>
               conv.id === id ? { ...conv, unreadCount: 0 } : conv
             ),
           };
         }
       );

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
     (conversationId: number | string, newCount: number) => {
       const id = typeof conversationId === 'string' ? parseInt(conversationId, 10) : conversationId;
       logger.debug('[UnreadBadges] Updating unread count', {
         conversationId: id,
         newCount,
       });

       // Update all conversation list queries using prefix matching
       queryClient.setQueriesData(
         { queryKey: ['conversations'] },
         (oldData: unknown) => {
           const data = oldData as { data?: ConversationListItem[] } | undefined;
           if (!data || !data.data) return oldData;

           return {
             ...data,
             data: data.data.map((conv: ConversationListItem) =>
               conv.id === id
                 ? { ...conv, unreadCount: newCount }
                 : conv
             ),
           };
         }
       );
     },
     [queryClient]
   );

   /**
    * Increments unread count by 1
    * Called when new inbound message arrives
    */
   const incrementUnreadCount = useCallback(
     (conversationId: number | string) => {
       const id = typeof conversationId === 'string' ? parseInt(conversationId, 10) : conversationId;
       
       // Update all conversation list queries using prefix matching
       queryClient.setQueriesData(
         { queryKey: ['conversations'] },
         (oldData: unknown) => {
           const data = oldData as { data?: ConversationListItem[] } | undefined;
           if (!data || !data.data) return oldData;

           return {
             ...data,
             data: data.data.map((conv: ConversationListItem) =>
               conv.id === id
                 ? { ...conv, unreadCount: (conv.unreadCount || 0) + 1 }
                 : conv
             ),
           };
         }
       );
     },
     [queryClient]
   );

  return {
    markAsRead,
    updateUnreadCount,
    incrementUnreadCount,
  };
}
