import { createParamDecorator, ForbiddenError } from 'routing-controllers';
import type { AuthUser, Permission } from '../types/auth.types';
import { PERMISSIONS } from '../types/auth.types';

// PERMISSIONS matrix is defined and exported in auth.types.ts
// This avoids duplication and keeps a single source of truth

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
export function RequirePermission(permission: Permission) {
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
export function hasPermission(user: AuthUser, permission: Permission): boolean {
  if (!user) return false;
  
  const userPermissions = PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission);
}
