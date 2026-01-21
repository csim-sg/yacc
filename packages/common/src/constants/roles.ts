/**
 * User Roles and Permissions
 */

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
} as const;

export const ROLE_PERMISSIONS = {
  super_admin: [
    'user.create',
    'user.read',
    'user.update',
    'user.delete',
    'integration.manage',
    'rules.manage',
    'audit.read',
    'conversation.all',
  ],
  admin: [
    'user.read',
    'inbox.manage',
    'conversation.assign',
    'conversation.tag',
    'conversation.note',
    'audit.read',
  ],
  manager: [
    'inbox.read',
    'conversation.assign',
    'conversation.update',
    'audit.read',
    'conversation.view_payload',
  ],
  user: [
    'inbox.read',
    'conversation.reply',
    'conversation.tag',
    'conversation.note',
  ],
} as const;
