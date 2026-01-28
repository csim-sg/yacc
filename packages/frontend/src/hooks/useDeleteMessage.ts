/**
 * Delete Message Hook
 * TanStack Query mutation for deleting messages
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';

interface DeleteMessageOptions {
  conversationId: string;
  messageId: string;
}

/**
 * Hook for deleting messages
 * Removes message and updates cache
 */
export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_options: DeleteMessageOptions) => {
      // TODO: Replace with actual API call
      // return await messageApi.deleteMessage(
      //   options.conversationId,
      //   options.messageId
      // );

      // Mock API call for now
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ success: true });
        }, 300);
      });
    },

    onSuccess: (_data, variables) => {
      // Invalidate message cache to refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(variables.conversationId),
      });

      // Also invalidate conversation detail
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(variables.conversationId),
      });
    },

    onError: (error) => {
      console.error('[useDeleteMessage] Failed to delete message:', error);
    },
  });
}
