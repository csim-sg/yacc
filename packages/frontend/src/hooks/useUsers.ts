/**
 * useUsers Hook
 *
 * TanStack Query hooks for user management data fetching and mutations.
 * Provides caching, background refetching, and optimistic updates.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '../services/users.service';
import type {
  UserFilters,
  UserPagination,
  CreateUserDTO,
  UpdateUserDTO,
} from '../types/user.types';

/**
 * Query key factory for users
 */
export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: (filters?: UserFilters, pagination?: UserPagination) =>
    [...usersKeys.lists(), { filters, pagination }] as const,
  details: () => [...usersKeys.all, 'detail'] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
  roles: () => [...usersKeys.all, 'roles'] as const,
};

/**
 * Hook for fetching users list with filters and pagination
 */
export function useUsers(
  filters?: UserFilters,
  pagination?: UserPagination
) {
  return useQuery({
    queryKey: usersKeys.list(filters, pagination),
    queryFn: () => usersService.listUsers(filters, pagination),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for creating a new user
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateUserDTO) => usersService.createUser(data),
    onSuccess: () => {
      // Invalidate all users lists to refetch
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
  });
}

/**
 * Hook for updating an existing user
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDTO }) =>
      usersService.updateUser(id, data),
    onSuccess: () => {
      // Invalidate all users lists to refetch
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
  });
}

/**
 * Hook for deleting a user
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    onSuccess: () => {
      // Invalidate all users lists to refetch
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
  });
}

/**
 * Hook for fetching available roles
 */
export function useRoles() {
  return useQuery({
    queryKey: usersKeys.roles(),
    queryFn: () => usersService.getRoles(),
    staleTime: 1000 * 60 * 60, // 1 hour (roles rarely change)
  });
}
