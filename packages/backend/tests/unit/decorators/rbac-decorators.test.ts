import { describe, it, expect, beforeEach } from 'vitest';
import { PERMISSIONS, hasPermission, type UserRole, type AuthUser } from '../../../src/types/auth.types';

/**
 * RBAC Decorator Tests
 * 
 * Tests for RequireRole and RequirePermission decorator logic
 * Tests the permission matrix completeness and consistency
 * 
 * @see packages/backend/src/decorators/require-role.decorator.ts
 * @see packages/backend/src/decorators/require-permission.decorator.ts
 */

describe('RBAC Decorators - Permission Matrix', () => {
  describe('Permission Matrix Structure', () => {
    it('should define permissions for all 4 roles', () => {
      const roles: UserRole[] = ['super_admin', 'admin', 'manager', 'user'];
      roles.forEach((role) => {
        expect(PERMISSIONS[role]).toBeDefined();
        expect(Array.isArray(PERMISSIONS[role])).toBe(true);
      });
    });

    it('should have super_admin with most permissions', () => {
      const superAdminPerms = PERMISSIONS['super_admin'];
      const adminPerms = PERMISSIONS['admin'];
      expect(superAdminPerms.length).toBeGreaterThan(adminPerms.length);
    });

    it('should have user with least permissions', () => {
      const userPerms = PERMISSIONS['user'];
      const managerPerms = PERMISSIONS['manager'];
      expect(userPerms.length).toBeLessThan(managerPerms.length);
    });

    it('should have no duplicate permissions within a role', () => {
      const roles: UserRole[] = ['super_admin', 'admin', 'manager', 'user'];
      roles.forEach((role) => {
        const perms = PERMISSIONS[role];
        const uniquePerms = new Set(perms);
        expect(uniquePerms.size).toBe(perms.length);
      });
    });
  });

  describe('Super Admin Permissions', () => {
    it('should have all 17 core permissions', () => {
      const superAdminPerms = PERMISSIONS['super_admin'];
      expect(superAdminPerms.length).toBeGreaterThanOrEqual(17);
    });

    it('should include user management permissions', () => {
      const perms = PERMISSIONS['super_admin'];
      expect(perms).toContain('users.create');
      expect(perms).toContain('users.update');
      expect(perms).toContain('users.delete');
      expect(perms).toContain('users.manage_roles');
    });

    it('should include integration management', () => {
      const perms = PERMISSIONS['super_admin'];
      expect(perms).toContain('integrations.manage');
    });

    it('should include routing rules management', () => {
      const perms = PERMISSIONS['super_admin'];
      expect(perms).toContain('routing_rules.manage');
    });

    it('should include audit access', () => {
      const perms = PERMISSIONS['super_admin'];
      expect(perms).toContain('audit.view');
      expect(perms).toContain('audit.export');
    });
  });

  describe('Admin Permissions', () => {
    it('should NOT have user management permissions', () => {
      const perms = PERMISSIONS['admin'];
      expect(perms).not.toContain('users.create');
      expect(perms).not.toContain('users.manage_roles');
    });

    it('should have conversation management permissions', () => {
      const perms = PERMISSIONS['admin'];
      expect(perms).toContain('conversations.view_all');
      expect(perms).toContain('conversations.assign');
    });

    it('should have audit access', () => {
      const perms = PERMISSIONS['admin'];
      expect(perms).toContain('audit.view');
      expect(perms).toContain('audit.export');
    });

    it('should have message retry permission', () => {
      const perms = PERMISSIONS['admin'];
      expect(perms).toContain('messages.retry');
    });
  });

  describe('Manager Permissions', () => {
    it('should have conversation management permissions', () => {
      const perms = PERMISSIONS['manager'];
      expect(perms).toContain('conversations.view_all');
      expect(perms).toContain('conversations.assign');
      expect(perms).toContain('conversations.change_priority');
    });

    it('should NOT have message retry permission', () => {
      const perms = PERMISSIONS['manager'];
      expect(perms).not.toContain('messages.retry');
    });

    it('should have audit access', () => {
      const perms = PERMISSIONS['manager'];
      expect(perms).toContain('audit.view');
      expect(perms).toContain('audit.export');
    });

    it('should have tag and note permissions', () => {
      const perms = PERMISSIONS['manager'];
      expect(perms).toContain('tags.create');
      expect(perms).toContain('notes.create');
    });
  });

  describe('User Permissions', () => {
    it('should NOT have admin permissions', () => {
      const perms = PERMISSIONS['user'];
      expect(perms).not.toContain('conversations.view_all');
      expect(perms).not.toContain('users.create');
      expect(perms).not.toContain('integrations.manage');
    });

    it('should have view_assigned conversations', () => {
      const perms = PERMISSIONS['user'];
      expect(perms).toContain('conversations.view_assigned');
    });

    it('should NOT have all conversation permissions', () => {
      const perms = PERMISSIONS['user'];
      expect(perms).not.toContain('conversations.view_all');
      expect(perms).not.toContain('conversations.assign');
      expect(perms).not.toContain('conversations.change_priority');
    });

    it('should be able to send messages and create notes', () => {
      const perms = PERMISSIONS['user'];
      expect(perms).toContain('messages.send');
      expect(perms).toContain('notes.create');
    });

    it('should NOT be able to view audit logs', () => {
      const perms = PERMISSIONS['user'];
      expect(perms).not.toContain('audit.view');
      expect(perms).not.toContain('audit.export');
    });

    it('should NOT be able to view raw payloads', () => {
      const perms = PERMISSIONS['user'];
      expect(perms).not.toContain('raw_payloads.view');
    });
  });

  describe('Permission Format Validation', () => {
    it('should use namespaced permission format (resource.action)', () => {
      const allPermissions = [
        ...PERMISSIONS['super_admin'],
        ...PERMISSIONS['admin'],
        ...PERMISSIONS['manager'],
        ...PERMISSIONS['user'],
      ];
      const uniquePerms = new Set(allPermissions);

      uniquePerms.forEach((perm) => {
        expect(perm).toMatch(/^[a-z_]+\.[a-z_]+$/);
      });
    });

    it('should have valid resource names', () => {
      const validResources = [
        'conversations',
        'messages',
        'tags',
        'notes',
        'users',
        'integrations',
        'routing_rules',
        'audit',
        'raw_payloads',
      ];
      const allPermissions = [
        ...PERMISSIONS['super_admin'],
        ...PERMISSIONS['admin'],
        ...PERMISSIONS['manager'],
        ...PERMISSIONS['user'],
      ];
      const uniquePerms = new Set(allPermissions);

      uniquePerms.forEach((perm) => {
        const [resource] = perm.split('.');
        expect(validResources).toContain(resource);
      });
    });
  });

  describe('hasPermission Helper Function', () => {
    it('should export hasPermission function from auth.types', () => {
      expect(typeof hasPermission).toBe('function');
    });

    it('should correctly check permissions', () => {
      const superAdmin: AuthUser = {
        id: '1',
        email: 'admin@test.com',
        name: 'Admin',
        role: 'super_admin',
        status: 'active',
        emailVerified: true,
        createdAt: new Date(),
      };

      expect(hasPermission(superAdmin, 'users.create' as any)).toBe(true);
    });

    it('should return false for missing permissions', () => {
      const user: AuthUser = {
        id: '2',
        email: 'user@test.com',
        name: 'User',
        role: 'user',
        status: 'active',
        emailVerified: true,
        createdAt: new Date(),
      };

      expect(hasPermission(user, 'users.create' as any)).toBe(false);
      expect(hasPermission(user, 'audit.view' as any)).toBe(false);
    });
  });

  describe('Permission Consistency Across Roles', () => {
    it('should have core permissions available to appropriate roles', () => {
      const coreConversationPerms = ['conversations.view_all', 'conversations.assign'];
      const adminPlus: UserRole[] = ['super_admin', 'admin', 'manager'];

      adminPlus.forEach((role) => {
        coreConversationPerms.forEach((perm) => {
          expect(PERMISSIONS[role]).toContain(perm);
        });
      });
    });

    it('should restrict sensitive permissions to super_admin only', () => {
      const sensitivePerms = [
        'users.create',
        'users.delete',
        'users.manage_roles',
        'integrations.manage',
        'routing_rules.manage',
      ];

      const roles: UserRole[] = ['admin', 'manager', 'user'];
      roles.forEach((role) => {
        sensitivePerms.forEach((perm) => {
          expect(PERMISSIONS[role]).not.toContain(perm);
        });
      });
    });

    it('should grant messaging permissions consistently', () => {
      const roles: UserRole[] = ['super_admin', 'admin', 'manager', 'user'];
      roles.forEach((role) => {
        expect(PERMISSIONS[role]).toContain('messages.send');
      });
    });
  });
});
