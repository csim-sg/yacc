/**
 * Users Service
 *
 * API client for user management operations (FE-019)
 * Uses the backend API endpoints from BE-006.
 */

import { api } from '../lib/apiClient';
import type {
  UserFilters,
  UserPagination,
  ListUsersResponse,
  CreateUserDTO,
  CreateUserResponse,
  UpdateUserDTO,
  UpdateUserResponse,
  DeleteUserResponse,
  ListRolesResponse,
} from '../types/user.types';

/**
 * Build query string from filters and pagination
 */
function buildQueryString(filters?: UserFilters, pagination?: UserPagination): string {
  const params = new URLSearchParams();

  if (pagination?.page) {
    params.set('page', String(pagination.page));
  }
  if (pagination?.limit) {
    params.set('limit', String(pagination.limit));
  }
  if (filters?.role) {
    params.set('role', filters.role);
  }
  if (filters?.status) {
    params.set('status', filters.status);
  }
  if (filters?.search) {
    params.set('search', filters.search);
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Users Service
 * Provides CRUD operations for user management
 */
class UsersService {
  private baseUrl = '/api/users';

  /**
   * List users with optional filters and pagination
   * GET /api/users
   */
  async listUsers(
    filters?: UserFilters,
    pagination?: UserPagination
  ): Promise<ListUsersResponse> {
    const queryString = buildQueryString(filters, pagination);
    return api.get<ListUsersResponse>(`${this.baseUrl}${queryString}`);
  }

  /**
   * Create a new user
   * POST /api/users
   */
  async createUser(data: CreateUserDTO): Promise<CreateUserResponse> {
    return api.post<CreateUserResponse>(this.baseUrl, data);
  }

  /**
   * Update an existing user
   * PUT /api/users/:id
   */
  async updateUser(id: string, data: UpdateUserDTO): Promise<UpdateUserResponse> {
    return api.put<UpdateUserResponse>(`${this.baseUrl}/${id}`, data);
  }

  /**
   * Delete a user (soft delete)
   * DELETE /api/users/:id
   */
  async deleteUser(id: string): Promise<DeleteUserResponse> {
    return api.delete<DeleteUserResponse>(`${this.baseUrl}/${id}`);
  }

  /**
   * Get available roles
   * GET /api/users/roles
   */
  async getRoles(): Promise<ListRolesResponse> {
    return api.get<ListRolesResponse>(`${this.baseUrl}/roles`);
  }
}

/**
 * Singleton export for use in components and hooks
 */
export const usersService = new UsersService();
