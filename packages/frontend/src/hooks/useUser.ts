/**
 * useUser Hook
 *
 * TanStack Query hook for fetching user profile information
 *
 * Features:
 * - Automatic caching (60s staleTime - user data changes less frequently)
 * - Auto-retry on failure (3x exponential backoff)
 * - Type-safe via Zod validation
 * - Handles 401 errors (unauthorized) gracefully
 * - Loading and error states
 *
 * Usage:
 * ```typescript
 * // Fetch current logged-in user
 * const { data: user, isLoading } = useCurrentUser();
 *
 * // Fetch specific user by ID
 * const { data: user, isLoading } = useUser('user-123');
 *
 * if (isLoading) return <LoadingSpinner />;
 * if (!user) return <ErrorMessage>User not found</ErrorMessage>;
 *
 * return <div>{user.name} ({user.email})</div>;
 * ```
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { UserSchema, type User } from '../api/schemas';
import { queryKeys } from '../lib/queryClient';

/**
 * useCurrentUser Hook
 *
 * Fetch the currently authenticated user's profile
 *
 * @returns Query result with user data
 *
 * @example
 * const { data: user, isLoading, error } = useCurrentUser();
 *
 * if (error?.statusCode === 401) {
 *   // User is not authenticated
 *   redirectToLogin();
 * }
 */
export function useCurrentUser(): UseQueryResult<User, Error> {
  return useQuery({
    // Use special query key for current user
    queryKey: queryKeys.user.current(),

    // Query function that fetches current user
    queryFn: async () => {
      const response = await apiClient.get('/api/auth/me');

      // Validate response with Zod schema
      const validatedData = UserSchema.parse(response);
      return validatedData;
    },

    // Cache settings
    staleTime: 60 * 1000, // 60 seconds (user data changes less frequently)
    gcTime: 10 * 60 * 1000, // 10 minutes

    // Retry strategy
    retry: (failureCount, error) => {
      // Don't retry on 401 (unauthorized) - user is not logged in
      if (error instanceof Error) {
        const errorMessage = error.message;
        if (errorMessage.includes('401')) {
          return false;
        }
      }

      // Retry up to 3 times for other errors
      return failureCount < 3;
    },

    // Refetching behavior
    refetchOnWindowFocus: false, // Don't auto-refetch when window regains focus
    refetchOnMount: false, // Don't refetch when component mounts if data is cached

    // Refetch interval: 5 minutes (optional, for long-lived sessions)
    // refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * useUser Hook
 *
 * Fetch a specific user by ID
 *
 * @param userId - The user ID to fetch (optional)
 * @returns Query result with user data
 *
 * @example
 * const { data: user } = useUser('user-456');
 *
 * @example
 * // Hook can be disabled by not providing userId
 * const userId = selectedUser?.id;
 * const { data: user } = useUser(userId);
 */
export function useUser(userId?: string): UseQueryResult<User, Error> {
  return useQuery({
    // Query key includes user ID for proper cache isolation
    queryKey: userId ? queryKeys.user.detail(userId) : ['user-empty'],

    // Query function that fetches user by ID
    queryFn: async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const response = await apiClient.get(`/api/users/${userId}`);

      // Validate response with Zod schema
      const validatedData = UserSchema.parse(response);
      return validatedData;
    },

    // Only run query if userId is provided
    enabled: !!userId,

    // Cache settings
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes

    // Retry strategy
    retry: (failureCount, error) => {
      // Don't retry on 401, 403 (no permission), or 404 (user not found)
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
  });
}

/**
 * useUserProfile Hook
 *
 * Alias for useCurrentUser - more semantic naming
 *
 * @returns Query result with current user's profile
 *
 * @example
 * const profile = useUserProfile();
 */
export function useUserProfile(): UseQueryResult<User, Error> {
  return useCurrentUser();
}
