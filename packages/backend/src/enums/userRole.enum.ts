import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * User Role Enum - Defines user permission levels
 * super_admin: Full access, manages users and settings
 * admin: Operations team, manages conversations and integrations
 * manager: Oversight and assignment management
 * user: Standard user, handles messages
 */
export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'admin',
  'manager',
  'user',
]);

export type UserRole = typeof userRoleEnum.enumValues[number];
