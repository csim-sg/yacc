import type { RoleType } from './role';

/**
 * Single navigation menu item (React `NavigationItem` port — W23).
 * `allowedRoles` lists the UI roles the item is visible for; visibility is
 * UX only, server-side Spring Security remains the boundary.
 */
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  allowedRoles: RoleType[];
  requiredPermission?: string;
}
