/**
 * useConversations Hook
 *
 * TanStack Query hook for fetching conversations with filtering and pagination
 *
 * Features:
 * - Automatic caching (30s staleTime)
 * - Auto-retry on failure (3x exponential backoff)
 * - Filter support (channel, status, assignee, tag)
 * - Pagination support
 * - Loading and error states
 * - Type-safe via Zod validation
 *
 * Usage:
 * ```typescript
 * const { data, isLoading, error, isPending } = useConversations({
 *   status: 'open',
 *   channel: 'telegram',
 *   page: 1,
 *   limit: 20,
 * });
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return (
 *   <div>
 *     {data?.data.map(conversation => (
 *       <ConversationItem key={conversation.id} {...conversation} />
 *     ))}
 *   </div>
 * );
 * ```
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ConversationsListSchema, type ConversationsList } from '../api/schemas';
import { queryKeys } from '../lib/queryClient';

/**
 * Conversation filter options
 */
export interface ConversationFilters {
  /** Filter by channel (telegram, irc, whatsapp, etc.) */
  channel?: string;

  /** Filter by status (open, pending, resolved) */
  status?: 'open' | 'pending' | 'resolved';

  /** Filter by assigned user ID */
  assignedUserId?: string;

  /** Filter by tag name */
  tag?: string;

  /** Search by conversation title or sender name */
  search?: string;

  /** Pagination: current page (1-based) */
  page?: number;

  /** Pagination: items per page */
  limit?: number;

  /** Sort field (createdAt, lastMessageAt, status) */
  sortBy?: 'createdAt' | 'lastMessageAt' | 'status';

  /** Sort direction (asc, desc) */
  sortOrder?: 'asc' | 'desc';
}

/**
 * useConversations Hook
 *
 * Fetch conversations from API with caching and filtering
 *
 * @param filters - Optional filter parameters
 * @param options - Additional TanStack Query options
 * @returns Query result with conversations data, loading state, and error
 *
 * @example
 * // Fetch all conversations
 * const { data } = useConversations();
 *
 * @example
 * // Fetch filtered conversations
 * const { data } = useConversations({
 *   status: 'open',
 *   channel: 'telegram',
 *   page: 1,
 *   limit: 20,
 * });
 */
export function useConversations(
  filters?: ConversationFilters
): UseQueryResult<ConversationsList, Error> {
  return useQuery({
    // Query key includes filters for proper cache management
    queryKey: queryKeys.conversations.filtered(
      (filters || {}) as Record<string, unknown>
    ),

    // Query function that fetches data from API
    queryFn: async () => {
      const response = await apiClient.get(
        '/api/conversations',
        {
          params: filters as Record<string, unknown>,
        }
      );

      // Validate response with Zod schema
      const validatedData = ConversationsListSchema.parse(response);
      return validatedData;
    },

    // Cache settings (inherited from QueryClient defaults, but can be overridden)
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes

    // Retry strategy
    retry: (failureCount, error) => {
      // Don't retry on 401 (unauthorized) or 403 (forbidden)
      if (error instanceof Error) {
        const errorMessage = error.message;
        if (errorMessage.includes('401') || errorMessage.includes('403')) {
          return false;
        }
      }

      // Retry up to 3 times for other errors
      return failureCount < 3;
    },

    // Prevent refetching while window is not focused
    refetchOnWindowFocus: false,

    // Don't refetch when component re-mounts if data is fresh
    refetchOnMount: false,
  });
}

/**
 * Hook to fetch a single conversation by ID
 *
 * @param conversationId - The conversation ID to fetch
 * @returns Query result with conversation data
 *
 * @example
 * const { data: conversation } = useConversation('conv-123');
 */
export function useConversation(
  conversationId?: string
): UseQueryResult<any, Error> {
  return useQuery({
    queryKey: conversationId
      ? queryKeys.conversations.detail(conversationId)
      : ['conversation-empty'],

    queryFn: async () => {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }

      return apiClient.get(`/api/conversations/${conversationId}`);
    },

    enabled: !!conversationId, // Only run query if conversationId is provided

    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,

    retry: (failureCount, error) => {
      if (error instanceof Error) {
        const errorMessage = error.message;
        if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.includes('404')) {
          return false;
        }
      }
      return failureCount < 3;
    },

    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to search conversations
 *
 * @param searchQuery - Search term
 * @param filters - Additional filters
 * @returns Query result with filtered conversations
 *
 * @example
 * const { data } = useSearchConversations('telegram group', { status: 'open' });
 */
export function useSearchConversations(
  searchQuery?: string,
  filters?: Omit<ConversationFilters, 'search'>
): UseQueryResult<ConversationsList, Error> {
  return useConversations({
    ...filters,
    search: searchQuery,
  });
}
