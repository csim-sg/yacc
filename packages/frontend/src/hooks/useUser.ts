/**
 * Current-session user hooks
 *
 * TanStack Query hooks for the authenticated user's own profile
 * (in-contract `GET /api/auth/get-session`).
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
 * if (isLoading) return <LoadingSpinner />;
 *
 * return <div>{user.name} ({user.email})</div>;
 * ```
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { UserSchema, type User } from '../api/schemas';
import { api as apiClient } from '../lib/apiClient';
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
      // Spring auth contract: the session lookup answers
      // `{ user, mustChangePassword }` (frozen openapi.yaml).
      const response = await apiClient.get<{
        user: unknown;
        mustChangePassword: boolean;
      }>('/api/auth/get-session');

      // Validate response with Zod schema
      const validatedData = UserSchema.parse(response.user);
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
