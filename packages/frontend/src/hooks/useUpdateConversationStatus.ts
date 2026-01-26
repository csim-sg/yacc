/**
 * useUpdateConversationStatus Hook
 *
 * TanStack Query mutation hook for updating conversation status
 *
 * Features:
 * - Change conversation status (open, pending, resolved)
 * - Automatic cache invalidation on success
 * - Loading and error states
 * - Type-safe via Zod validation
 *
 * Status Lifecycle:
 * - open: Active conversation, awaiting action
 * - pending: Agent replied, awaiting customer response
 * - resolved: Conversation closed/completed
 * - Auto-reopen: Resolved conversations reopen on new inbound message
 *
 * Usage:
 * ```typescript
 * const updateStatus = useUpdateConversationStatus();
 *
 * const handleStatusChange = async (conversationId: string, newStatus: 'open' | 'pending' | 'resolved') => {
 *   try {
 *     await updateStatus.mutateAsync({
 *       conversationId,
 *       status: newStatus,
 *     });
 *   } catch (error) {
 *     console.error('Failed to update status:', error);
 *   }
 * };
 *
 * return (
 *   <div>
 *     <select onChange={(e) => handleStatusChange(convId, e.target.value as any)}>
 *       <option value="open">Open</option>
 *       <option value="pending">Pending</option>
 *       <option value="resolved">Resolved</option>
 *     </select>
 *     {updateStatus.isPending && <span>Updating...</span>}
 *     {updateStatus.error && <div className="error">{updateStatus.error.message}</div>}
 *   </div>
 * );
 * ```
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { UpdateStatusResponseSchema, type UpdateStatusResponse } from '../api/schemas';
import { queryKeys } from '../lib/query-client';

/**
 * Update conversation status request payload
 */
export interface UpdateConversationStatusRequest {
  /** Conversation ID to update */
  conversationId: string;

  /** New status for the conversation */
  status: 'open' | 'pending' | 'resolved';
}

/**
 * useUpdateConversationStatus Hook
 *
 * Mutation hook for updating conversation status
 *
 * @returns Mutation object with mutate, mutateAsync, isPending, error, and data
 *
 * @example
 * // Using mutateAsync (with try/catch)
 * const updateStatus = useUpdateConversationStatus();
 * try {
 *   const response = await updateStatus.mutateAsync({
 *     conversationId: 'conv-123',
 *     status: 'resolved',
 *   });
 *   console.log('Status updated to:', response.status);
 * } catch (error) {
 *   console.error('Failed to update:', error);
 * }
 *
 * @example
 * // Using mutate (with callback)
 * const updateStatus = useUpdateConversationStatus();
 * updateStatus.mutate(
 *   { conversationId: 'conv-123', status: 'resolved' },
 *   {
 *     onSuccess: (response) => {
 *       console.log('Status updated to:', response.status);
 *     },
 *     onError: (error) => {
 *       console.error('Failed to update:', error);
 *     },
 *   }
 * );
 */
export function useUpdateConversationStatus(): UseMutationResult<
  UpdateStatusResponse,
  Error,
  UpdateConversationStatusRequest
> {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function that calls the API
    mutationFn: async (data: UpdateConversationStatusRequest) => {
      const response = await apiClient.patch(
        `/api/conversations/${data.conversationId}/status`,
        {
          status: data.status,
        }
      );

      // Validate response with Zod schema
      const validatedResponse = UpdateStatusResponseSchema.parse(response);
      return validatedResponse;
    },

    // On successful mutation, invalidate related queries
    onSuccess: (_response, variables) => {
      // Invalidate the specific conversation detail
      // This will update the status field
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(variables.conversationId),
      });

      // Invalidate conversations list to update status display in list
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(),
      });

      // Invalidate filtered conversations (in case filter includes status)
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.filtered({}),
      });
    },

    // Error handling
    onError: (error) => {
      // Additional mutation-level error handling can be added here
      console.error('[useUpdateConversationStatus] Mutation failed:', {
        message: error.message,
      });
    },
  });
}
