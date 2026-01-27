/**
 * useAssignConversation Hook
 *
 * TanStack Query mutation hook for assigning conversations to users
 *
 * Features:
 * - Assign conversation to a user
 * - Unassign conversation by passing null
 * - Automatic cache invalidation on success
 * - Loading and error states
 * - Type-safe via Zod validation
 *
 * Usage:
 * ```typescript
 * const assignConversation = useAssignConversation();
 *
 * const handleAssign = async (conversationId: string, userId: string | null) => {
 *   try {
 *     await assignConversation.mutateAsync({
 *       conversationId,
 *       assignedUserId: userId,
 *     });
 *   } catch (error) {
 *     console.error('Failed to assign:', error);
 *   }
 * };
 *
 * return (
 *   <div>
 *     <select onChange={(e) => handleAssign(convId, e.target.value)}>
 *       <option value="">Unassigned</option>
 *       <option value="user-1">John</option>
 *       <option value="user-2">Jane</option>
 *     </select>
 *     {assignConversation.isPending && <span>Assigning...</span>}
 *     {assignConversation.error && <div className="error">{assignConversation.error.message}</div>}
 *   </div>
 * );
 * ```
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { AssignConversationResponseSchema, type AssignConversationResponse } from '../api/schemas';
import { queryKeys } from '../lib/queryClient';

/**
 * Assign conversation request payload
 */
export interface AssignConversationRequest {
  /** Conversation ID to assign */
  conversationId: string;

  /** User ID to assign to (null to unassign) */
  assignedUserId: string | null;
}

/**
 * useAssignConversation Hook
 *
 * Mutation hook for assigning conversations to users
 *
 * @returns Mutation object with mutate, mutateAsync, isPending, error, and data
 *
 * @example
 * // Using mutateAsync (with try/catch)
 * const assignConversation = useAssignConversation();
 * try {
 *   const response = await assignConversation.mutateAsync({
 *     conversationId: 'conv-123',
 *     assignedUserId: 'user-456',
 *   });
 *   console.log('Assigned to:', response.assignedUser?.name);
 * } catch (error) {
 *   console.error('Failed to assign:', error);
 * }
 *
 * @example
 * // Using mutate (with callback)
 * const assignConversation = useAssignConversation();
 * assignConversation.mutate(
 *   { conversationId: 'conv-123', assignedUserId: 'user-456' },
 *   {
 *     onSuccess: (response) => {
 *       console.log('Assigned to:', response.assignedUser?.name);
 *     },
 *   }
 * );
 *
 * @example
 * // Unassigning (pass null)
 * const assignConversation = useAssignConversation();
 * assignConversation.mutate({
 *   conversationId: 'conv-123',
 *   assignedUserId: null, // This unassigns the conversation
 * });
 */
export function useAssignConversation(): UseMutationResult<
  AssignConversationResponse,
  Error,
  AssignConversationRequest
> {
  const queryClient = useQueryClient();

  return useMutation({
    // Mutation function that calls the API
    mutationFn: async (data: AssignConversationRequest) => {
      const response = await apiClient.patch(
        `/api/conversations/${data.conversationId}/assign`,
        {
          assignedUserId: data.assignedUserId,
        }
      );

      // Validate response with Zod schema
      const validatedResponse = AssignConversationResponseSchema.parse(response);
      return validatedResponse;
    },

    // On successful mutation, invalidate related queries
    onSuccess: (_response, variables) => {
      // Invalidate the specific conversation detail
      // This will update the assignedUserId and assignedUser
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(variables.conversationId),
      });

      // Invalidate conversations list to update assignee display in list
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(),
      });

      // Invalidate filtered conversations (in case filter includes assignee)
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.filtered({}),
      });
    },

    // Error handling
    onError: (error) => {
      // Additional mutation-level error handling can be added here
      console.error('[useAssignConversation] Mutation failed:', {
        message: error.message,
      });
    },
  });
}
