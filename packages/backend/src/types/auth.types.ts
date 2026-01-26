/**
 * Auth Types
 * Centralized type definitions for authentication and authorization
 */

/**
 * User roles in the system
 */
export type UserRole = 'super_admin' | 'admin' | 'manager' | 'user';

/**
 * User status in the system
 */
export type UserStatus = 'active' | 'inactive' | 'suspended';

/**
 * Authenticated user object (attached to request by auth middleware)
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
}

/**
 * JWT access token payload
 */
export interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  iat: number; // Issued at
  exp: number; // Expires at
}

/**
 * JWT refresh token payload
 */
export interface RefreshTokenPayload {
  sub: string; // User ID
  iat: number;
  exp: number;
}

/**
 * Login request DTO
 */
export interface LoginDto {
  email: string;
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

/**
 * Register user request DTO (super admin only)
 */
export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

/**
 * Forgot password request DTO
 */
export interface ForgotPasswordDto {
  email: string;
}

/**
 * Reset password request DTO
 */
export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

/**
 * Change password request DTO (authenticated user)
 */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

/**
 * Permission in the system (namespaced format for clarity)
 */
export type Permission =
  | 'conversations.view_all'
  | 'conversations.view_assigned'
  | 'conversations.assign'
  | 'conversations.change_priority'
  | 'messages.send'
  | 'messages.retry'
  | 'tags.create'
  | 'tags.apply'
  | 'notes.create'
  | 'users.create'
  | 'users.update'
  | 'users.delete'
  | 'users.manage_roles'
  | 'integrations.manage'
  | 'routing_rules.manage'
  | 'audit.view'
  | 'audit.export'
  | 'raw_payloads.view';

/**
 * Permission matrix for each role
 * Each role explicitly defines all permissions it has
 * 
 * @see .docs/plans/week1-product-owner-review.md (Section 3.3: Permission Matrix)
 */
export const PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'conversations.view_all',
    'conversations.view_assigned',
    'conversations.assign',
    'conversations.change_priority',
    'messages.send',
    'messages.retry',
    'tags.create',
    'tags.apply',
    'notes.create',
    'users.create',
    'users.update',
    'users.delete',
    'users.manage_roles',
    'integrations.manage',
    'routing_rules.manage',
    'audit.view',
    'audit.export',
    'raw_payloads.view',
  ],
  admin: [
    'conversations.view_all',
    'conversations.view_assigned',
    'conversations.assign',
    'conversations.change_priority',
    'messages.send',
    'messages.retry',
    'tags.create',
    'tags.apply',
    'notes.create',
    'audit.view',
    'audit.export',
    'raw_payloads.view',
  ],
  manager: [
    'conversations.view_all',
    'conversations.view_assigned',
    'conversations.assign',
    'conversations.change_priority',
    'messages.send',
    'tags.create',
    'tags.apply',
    'notes.create',
    'audit.view',
    'audit.export',
    'raw_payloads.view',
  ],
  user: [
    'conversations.view_assigned',
    'messages.send',
    'tags.create',
    'tags.apply',
    'notes.create',
  ],
};

/**
 * Role hierarchy (for reference only - MVP uses flat permission matrix)
 * 
 * NOTE: In MVP, each role has explicitly defined permissions (flat matrix).
 * Hierarchy is NOT used for permission inheritance to follow least-privilege principle.
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  user: 1,
};

/**
 * Check if user has permission (programmatic helper)
 * 
 * @param user - Authenticated user object
 * @param permission - Permission to check
 * @returns true if user has permission, false otherwise
 * 
 * @example
 * ```typescript
 * if (hasPermission(user, 'users.create')) {
 *   // User can create users
 * }
 * ```
 */
export function hasPermission(user: AuthUser, permission: Permission): boolean {
  if (!user) return false;
  const userPermissions = PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
}

/**
 * Check if user has minimum role level (reference only)
 * 
 * NOTE: For MVP, use hasPermission() instead of role levels
 * Role levels provided for future multi-tenant RBAC
 */
export function hasMinimumRole(user: AuthUser, minimumRole: UserRole): boolean {
  const userRoleLevel = ROLE_HIERARCHY[user.role] || 0;
  const requiredRoleLevel = ROLE_HIERARCHY[minimumRole] || 0;
  return userRoleLevel >= requiredRoleLevel;
}
