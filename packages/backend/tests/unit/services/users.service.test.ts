/**
 * Users Service Tests (BE-006)
 * Tests for user CRUD operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { dbClient } from '../../../src/infrastructure/db.client';
import { users } from '../../../src/schemas/user.schema';
import { usersService } from '../../../src/services/users.service';
import type { AuthUser } from '../../../src/types/auth.types';

describe('UsersService', () => {
  let superAdminUser: AuthUser;
  let regularUser: AuthUser;
  let testUserIds: string[] = [];

  // Helper to create test user in DB
  async function createTestUserInDB(userData: {
    id: string;
    email: string;
    name: string;
    role: 'super_admin' | 'admin' | 'manager' | 'user';
    status?: 'active' | 'inactive' | 'suspended';
    passwordHash?: string;
  }) {
    const result = await dbClient
      .insert(users)
      .values({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        passwordHash: userData.passwordHash || 'hashedpassword123',
        role: userData.role,
        status: userData.status || 'active',
        emailVerified: true,
      })
      .returning({ id: users.id });
    testUserIds.push(userData.id);
    return result[0];
  }

  beforeAll(async () => {
    // Create super admin for tests
    superAdminUser = {
      id: 'test-super-admin-be006',
      email: 'superadmin-be006@test.com',
      name: 'Super Admin',
      role: 'super_admin',
      status: 'active',
      emailVerified: true,
      createdAt: new Date(),
    };

    // Create regular user for tests
    regularUser = {
      id: 'test-regular-user-be006',
      email: 'regular-be006@test.com',
      name: 'Regular User',
      role: 'user',
      status: 'active',
      emailVerified: true,
      createdAt: new Date(),
    };

    await createTestUserInDB({
      id: superAdminUser.id,
      email: superAdminUser.email,
      name: superAdminUser.name,
      role: 'super_admin',
    });

    await createTestUserInDB({
      id: regularUser.id,
      email: regularUser.email,
      name: regularUser.name,
      role: 'user',
    });
  });

  afterAll(async () => {
    // Clean up all test users
    for (const userId of testUserIds) {
      try {
        await dbClient.delete(users).where(eq(users.id, userId));
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('listUsers', () => {
    it('should list users with default pagination', async () => {
      const result = await usersService.listUsers({}, superAdminUser);

      expect(result.users).toBeInstanceOf(Array);
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('should paginate users correctly', async () => {
      const result = await usersService.listUsers({ page: 1, limit: 50 }, superAdminUser);

      expect(result.pagination.limit).toBe(50);
    });

    it('should throw error for invalid page number', async () => {
      await expect(usersService.listUsers({ page: 0 }, superAdminUser)).rejects.toThrow(
        'Page must be >= 1'
      );
    });

    it('should throw error for invalid limit', async () => {
      await expect(usersService.listUsers({ limit: 15 }, superAdminUser)).rejects.toThrow(
        'Limit must be 20, 50, or 100'
      );
    });

    it('should throw error for invalid role filter', async () => {
      await expect(
        usersService.listUsers({ role: 'invalid' as 'super_admin' }, superAdminUser)
      ).rejects.toThrow('Invalid role value');
    });

    it('should throw error for invalid status filter', async () => {
      await expect(
        usersService.listUsers({ status: 'invalid' as 'active' }, superAdminUser)
      ).rejects.toThrow('Invalid status value');
    });

    it('should filter users by role', async () => {
      const result = await usersService.listUsers({ role: 'super_admin' }, superAdminUser);

      expect(result.users.every((u) => u.role === 'super_admin')).toBe(true);
    });

    it('should filter users by status', async () => {
      const result = await usersService.listUsers({ status: 'active' }, superAdminUser);

      expect(result.users.every((u) => u.status === 'active')).toBe(true);
    });

    it('should search users by email', async () => {
      const result = await usersService.listUsers(
        { search: 'superadmin-be006' },
        superAdminUser
      );

      expect(result.users.length).toBeGreaterThanOrEqual(1);
      expect(result.users[0].email).toContain('superadmin-be006');
    });

    it('should exclude soft-deleted users', async () => {
      // Create and soft-delete a user
      const deletedUserId = 'test-deleted-user-list';
      await createTestUserInDB({
        id: deletedUserId,
        email: 'deleted-list@test.com',
        name: 'Deleted User',
        role: 'user',
      });

      // Soft delete the user
      await dbClient
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.id, deletedUserId));

      // List users - should not include deleted user
      const result = await usersService.listUsers({}, superAdminUser);

      expect(result.users.find((u) => u.id === deletedUserId)).toBeUndefined();
    });
  });

  describe('createUser', () => {
    it('should create a new user successfully', async () => {
      const result = await usersService.createUser(
        {
          email: 'newuser-be006@test.com',
          password: 'SecurePassword123',
          name: 'New User',
          role: 'admin',
        },
        superAdminUser
      );

      testUserIds.push(result.id);
      expect(result.email).toBe('newuser-be006@test.com');
      expect(result.name).toBe('New User');
      expect(result.role).toBe('admin');
      expect(result.status).toBe('active');
      expect(result.id).toBeDefined();
    });

    it('should throw error for missing email', async () => {
      await expect(
        usersService.createUser(
          {
            email: '',
            password: 'SecurePassword123',
            name: 'Test',
            role: 'user',
          },
          superAdminUser
        )
      ).rejects.toThrow('Email is required');
    });

    it('should throw error for invalid email format', async () => {
      await expect(
        usersService.createUser(
          {
            email: 'invalid-email',
            password: 'SecurePassword123',
            name: 'Test',
            role: 'user',
          },
          superAdminUser
        )
      ).rejects.toThrow('Invalid email format');
    });

    it('should throw error for email too long', async () => {
      const longEmail = 'a'.repeat(250) + '@test.com'; // > 255 chars

      await expect(
        usersService.createUser(
          {
            email: longEmail,
            password: 'SecurePassword123',
            name: 'Test',
            role: 'user',
          },
          superAdminUser
        )
      ).rejects.toThrow('Email too long');
    });

    it('should throw error for duplicate email', async () => {
      await expect(
        usersService.createUser(
          {
            email: superAdminUser.email, // Already exists
            password: 'SecurePassword123',
            name: 'Duplicate',
            role: 'user',
          },
          superAdminUser
        )
      ).rejects.toThrow('Email already registered');
    });

    it('should throw error for missing password', async () => {
      await expect(
        usersService.createUser(
          {
            email: 'nopass@test.com',
            password: '',
            name: 'Test',
            role: 'user',
          },
          superAdminUser
        )
      ).rejects.toThrow('Password is required');
    });

    it('should throw error for password too short', async () => {
      await expect(
        usersService.createUser(
          {
            email: 'shortpass@test.com',
            password: 'short',
            name: 'Test',
            role: 'user',
          },
          superAdminUser
        )
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should throw error for missing name', async () => {
      await expect(
        usersService.createUser(
          {
            email: 'noname@test.com',
            password: 'SecurePassword123',
            name: '',
            role: 'user',
          },
          superAdminUser
        )
      ).rejects.toThrow('Name is required');
    });

    it('should throw error for invalid role', async () => {
      await expect(
        usersService.createUser(
          {
            email: 'badrole@test.com',
            password: 'SecurePassword123',
            name: 'Test',
            role: 'invalid' as 'super_admin',
          },
          superAdminUser
        )
      ).rejects.toThrow('Invalid role');
    });

    it('should normalize email to lowercase', async () => {
      const result = await usersService.createUser(
        {
          email: 'UPPERCASE@test.com',
          password: 'SecurePassword123',
          name: 'Upper Case',
          role: 'user',
        },
        superAdminUser
      );

      testUserIds.push(result.id);
      expect(result.email).toBe('uppercase@test.com');
    });
  });

  describe('updateUser', () => {
    let userToUpdate: { id: string };

    beforeEach(async () => {
      // Create a fresh user for each update test
      userToUpdate = await createTestUserInDB({
        id: `test-update-${Date.now()}`,
        email: `update-${Date.now()}@test.com`,
        name: 'User To Update',
        role: 'user',
      });
    });

    it('should update user role successfully', async () => {
      const result = await usersService.updateUser(
        userToUpdate.id,
        { role: 'admin' },
        superAdminUser
      );

      expect(result.role).toBe('admin');
      expect(result.id).toBe(userToUpdate.id);
    });

    it('should update user status successfully', async () => {
      const result = await usersService.updateUser(
        userToUpdate.id,
        { status: 'inactive' },
        superAdminUser
      );

      expect(result.status).toBe('inactive');
    });

    it('should update user name successfully', async () => {
      const result = await usersService.updateUser(
        userToUpdate.id,
        { name: 'Updated Name' },
        superAdminUser
      );

      expect(result.name).toBe('Updated Name');
    });

    it('should prevent self-modification of role', async () => {
      await expect(
        usersService.updateUser(superAdminUser.id, { role: 'admin' }, superAdminUser)
      ).rejects.toThrow('Cannot modify your own role or status');
    });

    it('should prevent self-modification of status', async () => {
      await expect(
        usersService.updateUser(superAdminUser.id, { status: 'inactive' }, superAdminUser)
      ).rejects.toThrow('Cannot modify your own role or status');
    });

    it('should allow self-modification of name only', async () => {
      const result = await usersService.updateUser(
        superAdminUser.id,
        { name: 'New Name' },
        superAdminUser
      );

      expect(result.name).toBe('New Name');
    });

    it('should throw error for invalid user ID', async () => {
      await expect(
        usersService.updateUser('non-existent-id', { role: 'admin' }, superAdminUser)
      ).rejects.toThrow('User not found');
    });

    it('should throw error for invalid role', async () => {
      await expect(
        usersService.updateUser(
          userToUpdate.id,
          { role: 'invalid' as 'super_admin' },
          superAdminUser
        )
      ).rejects.toThrow('Invalid role');
    });

    it('should throw error for invalid status', async () => {
      await expect(
        usersService.updateUser(
          userToUpdate.id,
          { status: 'invalid' as 'active' },
          superAdminUser
        )
      ).rejects.toThrow('Invalid status');
    });

    it('should throw error for duplicate email', async () => {
      await expect(
        usersService.updateUser(
          userToUpdate.id,
          { email: superAdminUser.email },
          superAdminUser
        )
      ).rejects.toThrow('Email already in use');
    });

    it('should throw error for invalid email format', async () => {
      await expect(
        usersService.updateUser(userToUpdate.id, { email: 'invalid-email' }, superAdminUser)
      ).rejects.toThrow('Invalid email format');
    });

    it('should throw error for updating soft-deleted user', async () => {
      // Create and soft-delete a user
      const deletedUser = await createTestUserInDB({
        id: `test-deleted-update-${Date.now()}`,
        email: `deleted-update-${Date.now()}@test.com`,
        name: 'Deleted Update User',
        role: 'user',
      });

      // Soft delete the user
      await dbClient
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.id, deletedUser.id));

      // Try to update the deleted user
      await expect(
        usersService.updateUser(deletedUser.id, { name: 'Updated Name' }, superAdminUser)
      ).rejects.toThrow('Cannot update a deleted user');
    });
  });

  describe('deleteUser', () => {
    let userToDelete: { id: string };

    beforeEach(async () => {
      // Create a fresh user for each delete test
      userToDelete = await createTestUserInDB({
        id: `test-delete-${Date.now()}`,
        email: `delete-${Date.now()}@test.com`,
        name: 'User To Delete',
        role: 'user',
      });
    });

    it('should soft delete user successfully', async () => {
      const result = await usersService.deleteUser(userToDelete.id, superAdminUser);

      expect(result.id).toBe(userToDelete.id);
      expect(result.deletedAt).toBeDefined();
      expect(result.deletedAt).toBeInstanceOf(Date);
    });

    it('should prevent self-deletion', async () => {
      await expect(
        usersService.deleteUser(superAdminUser.id, superAdminUser)
      ).rejects.toThrow('Cannot delete your own account');
    });

    it('should throw error for invalid user ID', async () => {
      await expect(
        usersService.deleteUser('non-existent-id', superAdminUser)
      ).rejects.toThrow('User not found');
    });

    it('should be idempotent for already deleted user', async () => {
      // First delete
      const firstDelete = await usersService.deleteUser(userToDelete.id, superAdminUser);

      // Second delete should return same deletedAt
      const secondDelete = await usersService.deleteUser(userToDelete.id, superAdminUser);

      expect(firstDelete.id).toBe(secondDelete.id);
      expect(firstDelete.deletedAt).toEqual(secondDelete.deletedAt);
    });
  });

  describe('getUserById', () => {
    it('should return user by ID', async () => {
      const result = await usersService.getUserById(superAdminUser.id);

      expect(result).not.toBeNull();
      expect(result?.id).toBe(superAdminUser.id);
      expect(result?.email).toBe(superAdminUser.email);
    });

    it('should return null for non-existent user', async () => {
      const result = await usersService.getUserById('non-existent-id');

      expect(result).toBeNull();
    });
  });
});
