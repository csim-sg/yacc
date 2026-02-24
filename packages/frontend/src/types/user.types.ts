/**
 * User Types
 *
 * Types for user management API operations.
 * Aligned with backend types from BE-006.
 */

/**
 * User role type (lowercase to match backend)
 */
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'user';

/**
 * User status type
 */
export type UserStatus = 'active' | 'inactive' | 'suspended';

/**
 * User response from API
 */
export type UserDTO = {
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
 * User filters for list query
 */
export type UserFilters = {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
};

/**
 * Pagination params for list query
 */
export type UserPagination = {
  page?: number;
  limit?: 20 | 50 | 100;
};

/**
 * List users response from API
 */
export type ListUsersResponse = {
  users: UserDTO[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

/**
 * Create user request body
 */
export type CreateUserDTO = {
  email: string;
  password: string;
  name: string;
  role: UserRole;
};

/**
 * Create user response from API
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
 * Update user request body
 */
export type UpdateUserDTO = {
  email?: string;
  name?: string;
  role?: UserRole;
  status?: UserStatus;
};

/**
 * Update user response from API
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
 * Delete user response from API
 */
export type DeleteUserResponse = {
  id: string;
  deletedAt: Date;
};

/**
 * Role definition for display
 */
export type RoleDefinition = {
  id: UserRole;
  label: string;
  description: string;
  permissions: string[];
};

/**
 * List roles response from API
 */
export type ListRolesResponse = {
  roles: RoleDefinition[];
};
