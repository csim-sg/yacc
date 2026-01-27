import { createParamDecorator, ForbiddenError } from 'routing-controllers';

/**
 * User roles in the system
 * 
 * @see .docs/01-product-specification.md (Section: User Roles & Permissions)
 */
type UserRole = 'super_admin' | 'admin' | 'manager' | 'user';

/**
 * Decorator to require specific role(s) for endpoint access
 * 
 * Checks if the authenticated user has one of the required roles.
 * If not authenticated or role doesn't match, throws 403 Forbidden.
 * 
 * @example
 * // Require Super Admin only
 * @RequireRole('super_admin')
 * async deleteUser(@RequireRole('super_admin') user: AuthUser) { ... }
 * 
 * // Require Admin or Super Admin
 * @RequireRole(['admin', 'super_admin'])
 * async createUser(@RequireRole(['admin', 'super_admin']) user: AuthUser) { ... }
 * 
 * @example Usage in Controller
 * ```
 * @Post('/users')
 * async createUser(
 *   @RequireRole(['admin', 'super_admin']) user: AuthUser,
 *   @Body() dto: CreateUserDto
 * ) {
 *   // Implementation
 * }
 * ```
 * 
 * @returns Express parameter decorator
 */
export function RequireRole(roles: UserRole | UserRole[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return createParamDecorator({
    required: true,
    value: (action) => {
      const user = (action.request as any).user;
      
      // Check if authenticated
      if (!user) {
        throw new ForbiddenError('Authentication required');
      }
      
      // Check if user has any of the required roles
      if (!allowedRoles.includes(user.role as UserRole)) {
        throw new ForbiddenError(
          `Access denied. Required role(s): ${allowedRoles.join(', ')}. Current role: ${user.role}`
        );
      }
      
      return user;
    },
  });
}
