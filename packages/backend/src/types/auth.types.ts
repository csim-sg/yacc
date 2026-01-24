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
 * Permission in the system
 */
export type Permission =
  | 'create_user'
  | 'edit_user'
  | 'delete_user'
  | 'manage_roles'
  | 'view_audit_logs'
  | 'export_audit_logs'
  | 'manage_integrations'
  | 'manage_routing_rules'
  | 'reply_to_conversation'
  | 'assign_conversation'
  | 'tag_conversation'
  | 'create_note'
  | 'view_raw_payload';

/**
 * Permission matrix for each role
 */
export const PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [
    'create_user',
    'edit_user',
    'delete_user',
    'manage_roles',
    'view_audit_logs',
    'export_audit_logs',
    'manage_integrations',
    'manage_routing_rules',
    'reply_to_conversation',
    'assign_conversation',
    'tag_conversation',
    'create_note',
    'view_raw_payload',
  ],
  admin: [
    'view_audit_logs',
    'export_audit_logs',
    'manage_routing_rules',
    'reply_to_conversation',
    'assign_conversation',
    'tag_conversation',
    'create_note',
    'view_raw_payload',
  ],
  manager: [
    'reply_to_conversation',
    'assign_conversation',
    'tag_conversation',
    'create_note',
    'view_audit_logs',
    'view_raw_payload',
  ],
  user: [
    'reply_to_conversation',
    'tag_conversation',
    'create_note',
  ],
};

/**
 * Role hierarchy (higher role includes lower roles' permissions)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 4,
  admin: 3,
  manager: 2,
  user: 1,
};

/**
 * Check if user has permission
 */
export function hasPermission(user: AuthUser, permission: Permission): boolean {
  const userPermissions = PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
}

/**
 * Check if user has minimum role level
 */
export function hasMinimumRole(user: AuthUser, minimumRole: UserRole): boolean {
  const userRoleLevel = ROLE_HIERARCHY[user.role] || 0;
  const requiredRoleLevel = ROLE_HIERARCHY[minimumRole] || 0;
  return userRoleLevel >= requiredRoleLevel;
}
