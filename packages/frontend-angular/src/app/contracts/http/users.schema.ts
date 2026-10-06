import { z } from 'zod';
import { baseListResponseSchema } from '../common/envelope.schema';
import { RoleSchema, UserStatusSchema } from '../common/role.schema';

/**
 * Users contract family (T3 §4.2 — live controllers, super_admin-gated).
 *
 * Wire irregularity encoded 1:1 (see `contracts/manifest.md`): the wire
 * list answer is the standard `BaseListResponse` `{ data, page, limit,
 * total }`; the React service type claims `{ users, pagination }` —
 * recorded DTO-claim drift row (W15 coverage is nav-level only).
 */

/** Wire user row (lowercase role/status labels — G9). */
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  role: RoleSchema,
  status: UserStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
});

export type User = z.infer<typeof UserSchema>;

/** GET /api/users?page&limit&role&status&search — query params. */
export const ListUsersParamsSchema = z.object({
  page: z.number().int().optional(),
  limit: z.number().int().optional(),
  role: RoleSchema.optional(),
  status: UserStatusSchema.optional(),
  search: z.string().optional(),
});

export type ListUsersParams = z.infer<typeof ListUsersParamsSchema>;

/** GET /api/users — `BaseListResponse` wire shape (drift note above). */
export const ListUsersResponseSchema = baseListResponseSchema(UserSchema);

export type ListUsersResponse = z.infer<typeof ListUsersResponseSchema>;

/** POST /api/users — always creates an active user with the given role. */
export const CreateUserRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
  name: z.string(),
  role: RoleSchema,
});

export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;

export const CreateUserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  role: RoleSchema,
  status: UserStatusSchema,
  createdAt: z.string(),
});

export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;

/** PUT /api/users/:id — partial update (self role/status change prevented server-side). */
export const UpdateUserRequestSchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  role: RoleSchema.optional(),
  status: UserStatusSchema.optional(),
});

export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;

export const UpdateUserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  role: RoleSchema,
  status: UserStatusSchema,
  updatedAt: z.string(),
});

export type UpdateUserResponse = z.infer<typeof UpdateUserResponseSchema>;

/** DELETE /api/users/:id — soft delete. */
export const DeleteUserResponseSchema = z.object({
  id: z.string().uuid(),
  deletedAt: z.string(),
});

export type DeleteUserResponse = z.infer<typeof DeleteUserResponseSchema>;

/** GET /api/users/roles — role display definitions (API-only today, G8). */
export const RoleDefinitionSchema = z.object({
  id: RoleSchema,
  label: z.string(),
  description: z.string(),
  permissions: z.array(z.string()),
});

export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;

export const ListRolesResponseSchema = z.object({
  roles: z.array(RoleDefinitionSchema),
});

export type ListRolesResponse = z.infer<typeof ListRolesResponseSchema>;
