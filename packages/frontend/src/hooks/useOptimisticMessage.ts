/**
 * Optimistic Message Update Hook
 * Handles optimistic UI updates for message send
 * - Show message immediately with "pending" status
 * - Reconcile tempId → serverId on success
 * - Rollback on error
 * - Prevent duplicate messages
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Message } from '../api/schemas';

interface OptimisticMessageOptions {
  conversationId: string;
  tempId?: string; // Generated UUID for tracking optimistic message
}

/**
 * Hook for managing optimistic message updates
 * Provides functions to:
 * - Add optimistic message to cache
 * - Reconcile tempId to serverId
 * - Rollback on error
 */
export function useOptimisticMessage() {
  const queryClient = useQueryClient();

  /**
   * Add optimistic message to timeline cache
   * Shows message immediately with pending status
   */
  const addOptimisticMessage = useCallback(
    (message: Message, options: OptimisticMessageOptions) => {
      const cacheKey = ['conversation', options.conversationId, 'messages'];

      queryClient.setQueryData(cacheKey, (oldData: any) => {
        if (!oldData) return { messages: [message], hasMore: false };

        return {
          ...oldData,
          messages: [...(oldData.messages || []), message],
        };
      });

      // Also update conversation detail with last message info
      const conversationCacheKey = ['conversation', options.conversationId];
      queryClient.setQueryData(conversationCacheKey, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          lastMessage: message.body,
          lastMessageAt: new Date().toISOString(),
          unreadCount: (oldData.unreadCount || 0) + 1,
        };
      });
    },
    [queryClient]
  );

  /**
   * Reconcile temporary message ID to server message ID
   * Called when server responds with created message
   */
  const reconcileMessageId = useCallback(
    (tempId: string, serverMessage: Message, conversationId: string) => {
      const cacheKey = ['conversation', conversationId, 'messages'];

      queryClient.setQueryData(cacheKey, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          messages: oldData.messages.map((msg: Message) => {
            // Replace optimistic message with server version
            if (msg.id === tempId) {
              return serverMessage;
            }
            return msg;
          }),
        };
      });
    },
    [queryClient]
  );

  /**
   * Rollback optimistic update on error
   * Removes message from cache (or marks as failed)
   */
  const rollbackOptimisticMessage = useCallback(
    (tempId: string, conversationId: string) => {
      const cacheKey = ['conversation', conversationId, 'messages'];

      queryClient.setQueryData(cacheKey, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          // Keep failed message in cache but mark as failed
          messages: oldData.messages.map((msg: Message) => {
            if (msg.id === tempId) {
              return {
                ...msg,
                status: 'failed' as const,
              };
            }
            return msg;
          }),
        };
      });

      // Update conversation metadata
      const conversationCacheKey = ['conversation', conversationId];
      queryClient.setQueryData(conversationCacheKey, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          // Decrement unread count since message send failed
          unreadCount: Math.max(0, (oldData.unreadCount || 0) - 1),
        };
      });
    },
    [queryClient]
  );

  /**
   * Remove optimistic message entirely (no failed state)
   */
  const removeOptimisticMessage = useCallback(
    (tempId: string, conversationId: string) => {
      const cacheKey = ['conversation', conversationId, 'messages'];

      queryClient.setQueryData(cacheKey, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          messages: oldData.messages.filter((msg: Message) => msg.id !== tempId),
        };
      });
    },
    [queryClient]
  );

  /**
   * Update message status (pending → sent)
   * Used when server confirms delivery
   */
  const updateMessageStatus = useCallback(
    (
      messageId: string,
      status: 'pending' | 'sent' | 'failed',
      conversationId: string
    ) => {
      const cacheKey = ['conversation', conversationId, 'messages'];

      queryClient.setQueryData(cacheKey, (oldData: any) => {
        if (!oldData) return oldData;

        return {
          ...oldData,
          messages: oldData.messages.map((msg: Message) => {
            if (msg.id === messageId) {
              return {
                ...msg,
                status,
              };
            }
            return msg;
          }),
        };
      });
    },
    [queryClient]
  );

  /**
   * Check if message with ID already exists in cache
   * Prevents duplicate messages from race conditions
   */
  const messageExists = useCallback(
    (messageId: string, conversationId: string): boolean => {
      const cacheKey = ['conversation', conversationId, 'messages'];
      const data = queryClient.getQueryData(cacheKey) as any;

      if (!data) return false;

      return data.messages?.some((msg: Message) => msg.id === messageId) || false;
    },
    [queryClient]
  );

  return {
    addOptimisticMessage,
    reconcileMessageId,
    rollbackOptimisticMessage,
    removeOptimisticMessage,
    updateMessageStatus,
    messageExists,
  };
}
