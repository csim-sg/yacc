import { z } from 'zod';

export const RoleEnum = z.enum(['super_admin', 'admin', 'manager', 'user']);
export const UserStatusEnum = z.enum(['active', 'inactive', 'suspended']);

export const Roles = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
} as const;

export const UserStatuses = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

export const RolePermissions = {
  super_admin: [
    'users:*',
    'roles:*',
    'integrations:*',
    'rules:*',
    'audit:*',
    'inbox:*',
    'messages:*',
    'collaboration:*',
  ],
  admin: [
    'inbox:*',
    'messages:*',
    'collaboration:*',
    'audit:read',
  ],
  manager: [
    'inbox:*',
    'messages:send',
    'messages:read',
    'collaboration:*',
    'audit:read',
    'rawPayloads:read',
  ],
  user: [
    'inbox:read',
    'messages:send',
    'messages:read',
    'collaboration:create',
    'collaboration:read',
  ],
} as const;

export const parseRole = (value: unknown) => RoleEnum.parse(value);
export const parseUserStatus = (value: unknown) => UserStatusEnum.parse(value);
