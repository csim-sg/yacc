/**
 * User Management Types
 * DTOs and interfaces for user CRUD operations (BE-006)
 */

import type { UserRole , UserStatus } from './auth.types';

/**
 * User response DTO (returned by API)
 */
export type UserResponse = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
};

/**
 * List users query parameters
 */
export type ListUsersQuery = {
  page?: number;
  limit?: number;
  role?: UserRole;
  status?: UserStatus;
  search?: string;
};

/**
 * List users response with pagination (service layer)
 * Service returns { data, total } - controller wraps in BaseListResponse
 */
export type ListUsersServiceResponse = {
  data: UserResponse[];
  total: number;
};

/**
 * Create user request DTO
 */
export type CreateUserBody = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
};

/**
 * Create user response DTO
 */
export type CreateUserResponse = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
};

/**
 * Update user request DTO (partial updates)
 */
export type UpdateUserBody = {
  email?: string;
  name?: string;
  role?: UserRole;
  status?: UserStatus;
};

/**
 * Update user response DTO
 */
export type UpdateUserResponse = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  updatedAt: Date;
};

/**
 * Delete user response DTO
 */
export type DeleteUserResponse = {
  id: string;
  deletedAt: Date;
};

/**
 * Role definition for GET /api/roles endpoint
 */
export type RoleDefinition = {
  id: UserRole;
  label: string;
  description: string;
  permissions: string[];
};

/**
 * List roles response
 */
export type ListRolesResponse = {
  roles: RoleDefinition[];
};

/**
 * User change metadata for audit logging
 */
export type UserChanges = {
  email?: { from: string; to: string };
  name?: { from: string; to: string };
  role?: { from: UserRole; to: UserRole };
  status?: { from: UserStatus; to: UserStatus };
};
