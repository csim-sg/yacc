/**
 * useMessages Hook
 *
 * TanStack Query hook for fetching messages in a conversation
 *
 * Features:
 * - Automatic caching (30s staleTime)
 * - Pagination support
 * - Auto-retry on failure (3x exponential backoff)
 * - Type-safe via Zod validation
 * - Loading and error states
 *
 * Usage:
 * ```typescript
 * const { data, isLoading, error } = useMessages('conversation-123', {
 *   page: 1,
 *   limit: 50,
 * });
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (error) return <ErrorMessage error={error} />;
 *
 * return (
 *   <div>
 *     {data?.data.map(message => (
 *       <Message key={message.id} {...message} />
 *     ))}
 *   </div>
 * );
 * ```
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { MessagesListSchema, MessageSchema, type MessagesList } from '../api/schemas';
import { queryKeys } from '../lib/queryClient';

/**
 * Message filter options
 */
export interface MessageFilters {
  /** Pagination: current page (1-based) */
  page?: number;

  /** Pagination: items per page */
  limit?: number;

  /** Sort by field (createdAt, status) */
  sortBy?: 'createdAt' | 'status';

  /** Sort direction (asc, desc) */
  sortOrder?: 'asc' | 'desc';
}

/**
 * useMessages Hook
 *
 * Fetch messages for a specific conversation
 *
 * @param conversationId - The conversation ID
 * @param filters - Optional filter parameters (pagination, sorting)
 * @returns Query result with messages data
 *
 * @example
 * const { data, isLoading } = useMessages('conv-123', { page: 1, limit: 50 });
 */
export function useMessages(
  conversationId?: string,
  filters?: MessageFilters
): UseQueryResult<MessagesList, Error> {
  return useQuery({
    // Query key includes conversation ID for proper cache isolation
    queryKey: conversationId
      ? queryKeys.messages.paginated(conversationId, filters?.page, filters?.limit)
      : ['messages-empty'],

    // Query function that fetches data from API
    queryFn: async () => {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }

      const response = await apiClient.get(
        `/api/conversations/${conversationId}/messages`,
        {
          params: filters as Record<string, unknown>,
        }
      );

      // Validate response with Zod schema
      const validatedData = MessagesListSchema.parse(response);
      return validatedData;
    },

    // Only run query if conversationId is provided
    enabled: !!conversationId,

    // Cache settings
    staleTime: 10 * 1000, // 10 seconds (messages change more frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes

    // Retry strategy
    retry: (failureCount, error) => {
      // Don't retry on 401, 403, or 404
      if (error instanceof Error) {
        const errorMessage = error.message;
        if (
          errorMessage.includes('401') ||
          errorMessage.includes('403') ||
          errorMessage.includes('404')
        ) {
          return false;
        }
      }

      // Retry up to 3 times for other errors
      return failureCount < 3;
    },

    // Refetching behavior
    refetchOnWindowFocus: false,
    refetchOnMount: false,

    // Invalidate older pages when new page is loaded
    // This helps maintain consistency in paginated data
  });
}

/**
 * Hook to fetch a single message by ID
 *
 * @param conversationId - The conversation ID
 * @param messageId - The message ID
 * @returns Query result with message data
 *
 * @example
 * const { data: message } = useMessage('conv-123', 'msg-456');
 */
export function useMessage(
  conversationId?: string,
  messageId?: string
): UseQueryResult<any, Error> {
  return useQuery({
    queryKey:
      conversationId && messageId
        ? ['message', conversationId, messageId]
        : ['message-empty'],

    queryFn: async () => {
      if (!conversationId || !messageId) {
        throw new Error('Conversation ID and Message ID are required');
      }

      const response = await apiClient.get(
        `/api/conversations/${conversationId}/messages/${messageId}`
      );

      // Validate with message schema
      return MessageSchema.parse(response);
    },

    enabled: !!conversationId && !!messageId,

    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,

    retry: (failureCount, error) => {
      if (error instanceof Error) {
        const errorMessage = error.message;
        if (
          errorMessage.includes('401') ||
          errorMessage.includes('403') ||
          errorMessage.includes('404')
        ) {
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
 * Hook to search messages in a conversation
 *
 * @param conversationId - The conversation ID
 * @param searchQuery - Search term
 * @param filters - Additional filters
 * @returns Query result with filtered messages
 *
 * @example
 * const { data } = useSearchMessages('conv-123', 'hello world', { page: 1 });
 */
export function useSearchMessages(
  conversationId?: string,
  searchQuery?: string,
  filters?: MessageFilters
): UseQueryResult<MessagesList, Error> {
  return useQuery({
    queryKey: conversationId
      ? ['messages-search', conversationId, searchQuery, filters]
      : ['messages-search-empty'],

    queryFn: async () => {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }

      const response = await apiClient.get(
        `/api/conversations/${conversationId}/messages`,
        {
          params: {
            ...filters,
            search: searchQuery,
          } as Record<string, unknown>,
        }
      );

      const validatedData = MessagesListSchema.parse(response);
      return validatedData;
    },

    enabled: !!conversationId,

    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,

    retry: (failureCount, error) => {
      if (error instanceof Error) {
        const errorMessage = error.message;
        if (
          errorMessage.includes('401') ||
          errorMessage.includes('403') ||
          errorMessage.includes('404')
        ) {
          return false;
        }
      }
      return failureCount < 3;
    },

    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
