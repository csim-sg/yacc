import type { NavigationItem } from '../types/navigation-item';
import type { RoleType } from '../types/role';

/**
 * Navigation Configuration (React `lib/navigation.ts` port — W23).
 *
 * Role-based navigation items for the YACC application; defines which
 * menu items are visible per role and the hierarchy used by `roleGuard`.
 * The Navigation/Header UI consumes this config; RBAC enforcement stays
 * server-side (Spring Security) — these checks are UX only.
 *
 * Roles (UI labels; normalized at the auth boundary):
 * - SUPER_ADMIN: full access
 * - ADMIN: no user management/integrations
 * - MANAGER: audit logs + raw payload access, no integration/rules/user management
 * - USER: inbox + assigned conversations only
 */

/**
 * Navigation menu items configuration.
 * Order matters — items render in this order.
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
    id: 'irc-profiles',
    label: 'IRC Profiles',
    href: '/integrations/irc-profiles',
    icon: '💬',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
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
 * Filter navigation items by user role.
 *
 * @param userRole - User's role
 * @returns Navigation items accessible by the user
 */
export function getAccessibleNavItems(userRole: RoleType): NavigationItem[] {
  return NAVIGATION_ITEMS.filter((item) => item.allowedRoles.includes(userRole));
}

/**
 * Check if user has access to a specific route.
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
 * Role hierarchy for permission checking.
 * Higher hierarchy means more permissions.
 */
export const ROLE_HIERARCHY: Record<RoleType, number> = {
  USER: 1,
  MANAGER: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

/**
 * Check if user role meets minimum requirement.
 *
 * @param userRole - User's role
 * @param minimumRole - Minimum required role
 * @returns true if user role meets the requirement
 */
export function meetsRoleRequirement(userRole: RoleType, minimumRole: RoleType): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}
