import { createParamDecorator } from 'routing-controllers';
import { ForbiddenError } from '../../utils/errors.js';
import type { AuthUser } from '../../types/auth.types.js';

/**
 * Permission matrix (from product owner requirements)
 * 
 * @see .docs/01-product-specification.md (User Roles & Permissions)
 * @see .docs/plans/week1-product-owner-review.md (Section 3.3: Permission Matrix)
 */
const PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    'conversations.view_all',
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
 * Decorator to require specific permission for endpoint access
 * 
 * Checks if user has required permission.
 * If not authenticated or permission missing, throws 403 Forbidden.
 * 
 * @example
 * // Require specific permission
 * @RequirePermission('users.create')
 * async createUser(@RequirePermission('users.create') user: AuthUser) { ... }
 * 
 * @example Usage in Controller
 * ```
 * @Post('/users')
 * async createUser(
 *   @RequirePermission('users.create') user: AuthUser,
 *   @Body() dto: CreateUserDto
 * ) {
 *   // Implementation
 * }
 * ```
 * 
 * @returns Express parameter decorator
 * 
 * @param permission - Permission string (e.g., 'users.create')
 */
export function RequirePermission(permission: string) {
  return createParamDecorator({
    required: true,
    value: (action) => {
      const user = (action.request as any).user as AuthUser | undefined;
      
      // Check if authenticated
      if (!user) {
        throw new ForbiddenError('Authentication required');
      }
      
      // Get user permissions
      const userPermissions = PERMISSIONS[user.role] || [];
      
      // Check if user has required permission
      if (!userPermissions.includes(permission)) {
        throw new ForbiddenError(
          `Access denied. Required permission: ${permission}`
        );
      }
      
      return user;
    },
  });
}

/**
 * Check if user has permission
 * 
 * Programmatic check for use in service layer.
 * 
 * @example
 * ```
 * if (hasPermission(user, 'users.create')) {
 *   // Can create user
 * }
 * ```
 * 
 * @returns boolean indicating if permission is granted
 * 
 * @param user - Authenticated user object
 * @param permission - Permission string to check
 */
export function hasPermission(user: AuthUser, permission: string): boolean {
  if (!user) return false;
  
  const userPermissions = PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
}
