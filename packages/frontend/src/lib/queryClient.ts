/**
 * TanStack Query Client Configuration
 *
 * Centralized QueryClient setup for YACC frontend
 * Manages caching, refetching, garbage collection, and retry logic
 *
 * Key Configuration:
 * - Stale Time: 30 seconds (data is fresh for 30s)
 * - GC Time: 5 minutes (keep unused data in cache for 5m)
 * - Retry: 3 attempts with exponential backoff (1s → 2s → 4s)
 * - Mutations: 1 attempt (no auto-retry for mutations)
 *
 * Aligned with Week 2 Architecture (week2-architect-review.md section 1.1)
 */

import {
  QueryClient,
  type QueryClientConfig,
} from '@tanstack/react-query';

/**
 * Create and configure QueryClient
 *
 * Performance optimized for YACC:
 * - Conversations: Refresh every 30s
 * - Messages: Refresh every 30s
 * - User: Refresh on auth state change
 *
 * @returns Configured QueryClient instance
 */
export function createQueryClient(): QueryClient {
  const queryClientConfig: QueryClientConfig = {
    defaultOptions: {
      queries: {
        // Data freshness
        staleTime: 30 * 1000, // 30 seconds - data is fresh for 30s after fetch
        gcTime: 5 * 60 * 1000, // 5 minutes - garbage collect after 5m of no use

        // Retry strategy for queries
        retry: 3, // Retry 3 times on failure
        retryDelay: (attemptIndex) => {
          // Exponential backoff: 1s, 2s, 4s
          return Math.min(1000 * 2 ** attemptIndex, 30 * 1000);
        },

        // Networking
        networkMode: 'online', // Only query when online (don't retry when offline)

        // General settings
        throwOnError: false, // Don't throw errors - we handle them in components
      },

      mutations: {
        // Retry strategy for mutations
        retry: 1, // Retry 1 time for mutations (less aggressive than queries)
        retryDelay: (attemptIndex) => {
          return Math.min(1000 * 2 ** attemptIndex, 30 * 1000);
        },

        // Networking
        networkMode: 'online', // Only mutate when online

        // General settings
        throwOnError: false, // Handle mutation errors in components
      },
    },
  };

  return new QueryClient(queryClientConfig);
}

/**
 * Global QueryClient instance
 * Created once at app startup and reused throughout
 */
export const queryClient = createQueryClient();

/**
 * Query Key Factory
 *
 * Centralized query key generation following React Query best practices
 * Ensures consistent cache key naming across the app
 *
 * Usage:
 * ```typescript
 * // Query for all conversations
 * const { data } = useQuery({
 *   queryKey: queryKeys.conversations.list(),
 *   queryFn: () => fetchConversations(),
 * });
 *
 * // Query for single conversation
 * const { data } = useQuery({
 *   queryKey: queryKeys.conversations.detail(conversationId),
 *   queryFn: () => fetchConversation(conversationId),
 * });
 *
 * // Query for messages
 * const { data } = useQuery({
 *   queryKey: queryKeys.messages.list(conversationId),
 *   queryFn: () => fetchMessages(conversationId),
 * });
 * ```
 */
export const queryKeys = {
  /**
   * Conversation query keys
   * Scope: /api/conversations
   */
  conversations: {
    /**
     * Root key for all conversation queries
     */
    all: () => ['conversations'] as const,

    /**
     * List of conversations (with optional filters)
     * Includes pagination and filtering
     */
    list: (filters?: Record<string, unknown>) =>
      [{ scope: 'conversations', type: 'list', ...filters }] as const,

    /**
     * Detail key for specific conversation
     * Used for single conversation queries
     */
    detail: (conversationId: string) =>
      [{ scope: 'conversations', type: 'detail', id: conversationId }] as const,

    /**
     * Paginated list of conversations
     */
    paginated: (page?: number, limit?: number) =>
      [{ scope: 'conversations', type: 'paginated', page, limit }] as const,

    /**
     * Filtered conversations (by status, channel, etc.)
     */
    filtered: (filters: {
      channel?: string;
      status?: string;
      assignedUserId?: string;
      tag?: string;
      page?: number;
      limit?: number;
    }) => [{ scope: 'conversations', type: 'filtered', ...filters }] as const,
  },

  /**
   * Message query keys
   * Scope: /api/conversations/:id/messages
   */
  messages: {
    /**
     * Root key for all message queries
     */
    all: () => ['messages'] as const,

    /**
     * List of messages for a conversation
     */
    list: (conversationId: string) =>
      [{ scope: 'messages', type: 'list', conversationId }] as const,

    /**
     * Paginated messages for a conversation
     */
    paginated: (conversationId: string, page?: number, limit?: number) =>
      [
        {
          scope: 'messages',
          type: 'paginated',
          conversationId,
          page,
          limit,
        },
      ] as const,

    /**
     * Single message detail
     */
    detail: (messageId: string) =>
      [{ scope: 'messages', type: 'detail', id: messageId }] as const,
  },

  /**
   * User query keys
   * Scope: /api/auth/me or /api/users/:id
   */
  user: {
    /**
     * Root key for all user queries
     */
    all: () => ['user'] as const,

    /**
     * Current logged-in user
     */
    current: () => [{ scope: 'user', type: 'current' }] as const,

    /**
     * Specific user by ID
     */
    detail: (userId: string) =>
      [{ scope: 'user', type: 'detail', id: userId }] as const,

    /**
     * User profile
     */
    profile: () => [{ scope: 'user', type: 'profile' }] as const,
  },

  /**
   * Audit log query keys
   * Scope: /api/audit-logs
   */
  auditLogs: {
    /**
     * Root key for all audit log queries
     */
    all: () => ['auditLogs'] as const,

    /**
     * List of audit logs
     */
    list: (filters?: Record<string, unknown>) =>
      [{ scope: 'auditLogs', type: 'list', ...filters }] as const,
  },
} as const;

/**
 * Cache Invalidation Helpers
 *
 * Helper functions to invalidate specific query caches
 * Used after mutations to keep data in sync
 *
 * Usage:
 * ```typescript
 * const queryClient = useQueryClient();
 *
 * useMutation({
 *   mutationFn: (data) => assignConversation(data),
 *   onSuccess: () => {
 *     invalidateConversations(queryClient);
 *   },
 * });
 * ```
 */
export const cacheInvalidation = {
  /**
   * Invalidate all conversation queries
   */
  invalidateConversations: (queryClient: QueryClient): Promise<void> =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversations.all(),
    }),

  /**
   * Invalidate conversation list only (not details)
   */
  invalidateConversationList: (queryClient: QueryClient): Promise<void> =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversations.list(),
    }),

  /**
   * Invalidate specific conversation detail
   */
  invalidateConversationDetail: (
    queryClient: QueryClient,
    conversationId: string
  ): Promise<void> =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversations.detail(conversationId),
    }),

  /**
   * Invalidate all message queries
   */
  invalidateMessages: (queryClient: QueryClient): Promise<void> =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.messages.all(),
    }),

  /**
   * Invalidate messages for specific conversation
   */
  invalidateConversationMessages: (
    queryClient: QueryClient,
    conversationId: string
  ): Promise<void> =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.messages.list(conversationId),
    }),

  /**
   * Invalidate all user queries
   */
  invalidateUser: (queryClient: QueryClient): Promise<void> =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.user.all(),
    }),

  /**
   * Invalidate current user (after auth change)
   */
  invalidateCurrentUser: (queryClient: QueryClient): Promise<void> =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.user.current(),
    }),

  /**
   * Invalidate all audit logs
   */
  invalidateAuditLogs: (queryClient: QueryClient): Promise<void> =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.auditLogs.all(),
    }),

  /**
   * Invalidate everything (nuclear option)
   * Use after logout or major auth state change
   */
  invalidateAll: (queryClient: QueryClient): Promise<void> =>
    queryClient.invalidateQueries(),
};
