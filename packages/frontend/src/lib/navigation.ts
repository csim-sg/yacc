/**
 * Navigation Configuration
 *
 * Role-based navigation items mapping for YACC application
 * Defines which menu items are visible for each user role
 *
 * Roles:
 * - SUPER_ADMIN: Full access to all features
 * - ADMIN: No user management, no settings
 * - MANAGER: No integration/rules/user management, has audit logs + raw payload access
 * - USER: Only inbox, assigned conversations visible
 */

export type RoleType = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  allowedRoles: RoleType[];
  requiredPermission?: string;
}

/**
 * Navigation menu items configuration
 * Order matters - items are rendered in this order
 */
export const NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'inbox',
    label: 'Inbox',
    href: '/inbox',
    icon: '📋',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER'],
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    href: '/audit-logs',
    icon: '📊',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
  },
  {
    id: 'users',
    label: 'Users',
    href: '/users',
    icon: '👥',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    href: '/integrations',
    icon: '🔌',
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
     id: 'routing-rules',
     label: 'Routing Rules',
     href: '/routing-rules',
     icon: '⚙️',
     allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
   },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: '⚙️',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
  },
];

/**
 * Filter navigation items by user role
 *
 * @param userRole - User's role
 * @returns Navigation items accessible by the user
 */
export function getAccessibleNavItems(userRole: RoleType): NavigationItem[] {
  return NAVIGATION_ITEMS.filter((item) => item.allowedRoles.includes(userRole));
}

/**
 * Check if user has access to a specific route
 *
 * @param userRole - User's role
 * @param href - Route path
 * @returns true if user can access the route
 */
export function hasAccessToRoute(userRole: RoleType, href: string): boolean {
  const item = NAVIGATION_ITEMS.find((item) => item.href === href);
  if (!item) return false;
  return item.allowedRoles.includes(userRole);
}

/**
 * Role hierarchy for permission checking
 * Higher hierarchy means more permissions
 */
export const ROLE_HIERARCHY: Record<RoleType, number> = {
  USER: 1,
  MANAGER: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

/**
 * Check if user role meets minimum requirement
 *
 * @param userRole - User's role
 * @param minimumRole - Minimum required role
 * @returns true if user role meets the requirement
 */
export function meetsRoleRequirement(
  userRole: RoleType,
  minimumRole: RoleType
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}
