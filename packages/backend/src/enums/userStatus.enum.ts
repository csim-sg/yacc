import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * User Status Enum - Defines user account state
 * active: User account is active
 * inactive: User account is inactive
 * suspended: User account is suspended
 */
export const userStatusEnum = pgEnum('user_status', ['active', 'inactive', 'suspended']);

export type UserStatus = typeof userStatusEnum.enumValues[number];
