/**
 * User management contract types (MIG-041; SPEC-002 AC-07; ADR-023).
 *
 * GENERATED-contract-derived: aliases of the frozen contract types in
 * `../api/contract/rest-api.gen.ts` (generated from
 * `.docs/migration/openapi.yaml`) — shapes are the contract's, never
 * re-declared by hand. Query/filter parameter types mirror the frozen
 * `listUsers` operation parameters.
 */

import type { components, operations } from '../api/contract/rest-api.gen';

type Schemas = components['schemas'];
type Operations = operations;

/** Frozen wire user (`UserResponse`): uuid id, lowercase role/status labels, ISO date-time strings. */
export type UserDTO = Schemas['UserResponse'];

/** Frozen user role labels (`UserRole`). */
export type UserRole = Schemas['UserRole'];

/** Frozen user status labels (`UserStatus`). */
export type UserStatus = Schemas['UserStatus'];

/** Extract an inline `application/json` request body from a generated operation. */
type JsonBody<Op> = Op extends {
  requestBody?: { content: { 'application/json': infer Body } };
}
  ? Body
  : never;

/** POST /api/users — create user body (role is server-fixed by RBAC on the wire). */
export type CreateUserDTO = JsonBody<Operations['createUser']>;

/** PUT /api/users/:id — partial update body. */
export type UpdateUserDTO = JsonBody<Operations['updateUser']>;

/** User list query filters (`GET /api/users` query parameters). */
export type UserFilters = NonNullable<
  Operations['listUsers']['parameters']['query']
>;

/** User list pagination parameters (contract: limit ∈ {20, 50, 100}). */
export type UserPagination = Pick<UserFilters, 'page' | 'limit'>;

/**
 * `GET /api/users` response — the frozen `BaseListResponse` envelope
 * `{data, page, limit, total}` with `UserResponse` items.
 */
export type ListUsersResponse = NonNullable<
  Operations['listUsers']['responses'][200]['content']['application/json']
>;

/** POST /api/users — 201 response. */
export type CreateUserResponse = Schemas['CreateUserResponse'];

/** PUT /api/users/:id — 200 response. */
export type UpdateUserResponse = Schemas['UpdateUserResponse'];

/** DELETE /api/users/:id — soft-deleted user representation. */
export type DeleteUserResponse = Schemas['DeleteUserResponse'];

/** Role definition for display (`GET /api/users/roles` items). */
export type RoleDefinition = NonNullable<
  Operations['listUserRoles']['responses'][200]['content']['application/json']
>['roles'][number];

/** GET /api/users/roles — static 4-role definitions with permissions. */
export type ListRolesResponse = NonNullable<
  Operations['listUserRoles']['responses'][200]['content']['application/json']
>;
