/**
 * Edit Message Hook
 * TanStack Query mutation for editing messages
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';

interface EditMessageOptions {
  conversationId: string;
  messageId: string;
  body: string;
}

/**
 * Hook for editing messages
 * Updates message and invalidates cache
 */
export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: EditMessageOptions) => {
      // TODO: Replace with actual API call
      // return await messageApi.editMessage(
      //   options.conversationId,
      //   options.messageId,
      //   { body: options.body }
      // );

      // Mock API call for now
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            id: options.messageId,
            body: options.body,
            editedAt: new Date().toISOString(),
          });
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
      console.error('[useEditMessage] Failed to edit message:', error);
    },
  });
}
