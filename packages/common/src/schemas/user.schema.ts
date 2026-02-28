/**
 * User Request Schemas
 *
 * Zod schemas for validating user-related requests.
 *
 * @module @yacc/common/schemas
 * @see ADR-020 - Zod as source of truth
 */

import { z } from 'zod';
import { RoleEnum, UserStatusEnum } from '../constants/roles.constant.js';

/**
 * Create user request body schema
 * Validates parameters for creating a new user
 */
export const CreateUserRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(255).optional(),
  role: RoleEnum.optional().default('user'),
});

/**
 * Inferred type for create user request
 */
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

/**
 * Update user request body schema
 * Validates parameters for updating a user
 */
export const UpdateUserRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email('Invalid email format').optional(),
  status: UserStatusEnum.optional(),
});

/**
 * Inferred type for update user request
 */
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

/**
 * Change user role request body schema
 */
export const ChangeUserRoleRequestSchema = z.object({
  role: RoleEnum,
});

/**
 * Inferred type for change user role request
 */
export type ChangeUserRoleRequest = z.infer<typeof ChangeUserRoleRequestSchema>;

/**
 * List users query parameters schema
 */
export const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  role: RoleEnum.optional(),
  status: UserStatusEnum.optional(),
  search: z.string().max(255).optional(),
});

/**
 * Inferred type for list users query
 */
export type ListUsersQuery = z.infer<typeof ListUsersQuerySchema>;
