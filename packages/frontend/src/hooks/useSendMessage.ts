/**
 * useSendMessage Hook
 *
 * TanStack Query mutation hook for sending messages in a conversation
 *
 * Features:
 * - Send outbound messages to conversations
 * - Support for attachments (optional)
 * - Automatic cache invalidation on success
 * - Loading and error states
 * - Type-safe via Zod validation
 *
 * Usage:
 * ```typescript
 * const sendMessage = useSendMessage();
 *
 * const handleSendMessage = async (conversationId: string, messageBody: string) => {
 *   try {
 *     await sendMessage.mutateAsync({
 *       conversationId,
 *       body: messageBody,
 *     });
 *   } catch (error) {
 *     console.error('Failed to send message:', error);
 *   }
 * };
 *
 * return (
 *   <div>
 *     <textarea
 *       placeholder="Type message..."
 *       disabled={sendMessage.isPending}
 *     />
 *     <button onClick={() => handleSendMessage(convId, text)}>
 *       {sendMessage.isPending ? 'Sending...' : 'Send'}
 *     </button>
 *     {sendMessage.error && <div className="error">{sendMessage.error.message}</div>}
 *   </div>
 * );
 * ```
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { SendMessageResponseSchema, type SendMessageResponse } from '../api/schemas';
import { queryKeys } from '../lib/query-client';

/**
 * Send message request payload
 */
export interface SendMessageRequest {
  /** Conversation ID to send message to */
  conversationId: string;

  /** Message body (text content) */
  body: string;

  /** Optional attachment IDs to include with message */
  attachmentIds?: string[];
}

/**
 * useSendMessage Hook
 *
 * Mutation hook for sending messages in a conversation
 *
 * @returns Mutation object with mutate, mutateAsync, isPending, error, and data
 *
 * @example
 * // Using mutateAsync (with try/catch)
 * const sendMessage = useSendMessage();
 * try {
 *   const response = await sendMessage.mutateAsync({
 *     conversationId: 'conv-123',
 *     body: 'Hello!',
 *   });
 *   console.log('Message sent:', response.id);
 * } catch (error) {
 *   console.error('Failed to send:', error);
 * }
 *
 * @example
 * // Using mutate (with callback)
 * const sendMessage = useSendMessage();
 * sendMessage.mutate(
 *   { conversationId: 'conv-123', body: 'Hello!' },
 *   {
 *     onSuccess: (response) => {
 *       console.log('Message sent:', response.id);
 *     },
 *     onError: (error) => {
 *       console.error('Failed to send:', error);
 *     },
 *   }
 * );
 */
export function useSendMessage(): UseMutationResult<SendMessageResponse, Error, SendMessageRequest> {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function that calls the API
    mutationFn: async (data: SendMessageRequest) => {
      const response = await apiClient.post(
        `/api/conversations/${data.conversationId}/messages`,
        {
          body: data.body,
          attachmentIds: data.attachmentIds,
        }
      );

      // Validate response with Zod schema
      const validatedResponse = SendMessageResponseSchema.parse(response);
      return validatedResponse;
    },

    // On successful mutation, invalidate related queries
    onSuccess: (_response, variables) => {
      // Invalidate messages list for this conversation
      // This will trigger a refetch of messages in useMessages hook
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(variables.conversationId),
      });

      // Also invalidate the specific conversation detail
      // to update lastMessage and other conversation metadata
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(variables.conversationId),
      });

      // Invalidate conversations list to update lastMessage in list view
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(),
      });
    },

    // Error handling (logs are done in apiClient, but we can add mutation-level error handling here)
    onError: (error) => {
      // Additional mutation-level error handling can be added here
      // For now, error will be available in the mutation result
      console.error('[useSendMessage] Mutation failed:', {
        message: error.message,
      });
    },
  });
}
