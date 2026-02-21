/**
 * Users Controller Integration Tests (BE-006)
 * Tests for user management API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { eq } from 'drizzle-orm';
import { createTestApp, createTestUser } from '../../test-helpers';
import { dbClient } from '../../../src/infrastructure/db.client';
import { users } from '../../../src/schemas/user.schema';

describe('Users Controller (BE-006)', () => {
  let app: Express;
  let superAdminToken: string;
  let superAdminId: string;
  let regularUserToken: string;
  let regularUserId: string;
  let testUserIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();

    // Create super admin user
    const superAdmin = await createTestUser(app, {
      email: 'superadmin-api-be006@test.com',
      password: 'Password123!',
      role: 'super_admin',
      name: 'Super Admin API',
    });
    superAdminToken = superAdmin.token;
    superAdminId = superAdmin.id;
    testUserIds.push(superAdminId);

    // Create regular user
    const regularUser = await createTestUser(app, {
      email: 'regular-api-be006@test.com',
      password: 'Password123!',
      role: 'user',
      name: 'Regular User API',
    });
    regularUserToken = regularUser.token;
    regularUserId = regularUser.id;
    testUserIds.push(regularUserId);
  });

  afterAll(async () => {
    // Clean up test users
    for (const userId of testUserIds) {
      try {
        await dbClient.delete(users).where(eq(users.id, userId));
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('GET /api/users', () => {
    it('should list users for super_admin', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.pagination).toHaveProperty('total');
      expect(response.body.pagination).toHaveProperty('page');
      expect(response.body.pagination).toHaveProperty('limit');
      expect(response.body.pagination).toHaveProperty('totalPages');
    });

    it('should return 403 for non-super_admin users', async () => {
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app).get('/api/users').expect(401);
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/users?page=1&limit=50')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(50);
    });

    it('should return 400 for invalid page', async () => {
      const response = await request(app)
        .get('/api/users?page=0')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);

      expect(response.body.message || response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid limit', async () => {
      const response = await request(app)
        .get('/api/users?limit=15')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(400);

      expect(response.body.message || response.body.errors).toBeDefined();
    });

    it('should filter by role', async () => {
      const response = await request(app)
        .get('/api/users?role=super_admin')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.users.every((u: { role: string }) => u.role === 'super_admin')).toBe(
        true
      );
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/users?status=active')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.users.every((u: { status: string }) => u.status === 'active')).toBe(
        true
      );
    });

    it('should search by email', async () => {
      const response = await request(app)
        .get('/api/users?search=superadmin-api-be006')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.users.length).toBeGreaterThanOrEqual(1);
      expect(response.body.users[0].email).toContain('superadmin-api-be006');
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const uniqueEmail = `newuser-api-be006-${Date.now()}@test.com`;
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: uniqueEmail,
          password: 'SecurePassword123',
          name: 'New API User',
          role: 'admin',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(uniqueEmail);
      expect(response.body.name).toBe('New API User');
      expect(response.body.role).toBe('admin');
      expect(response.body.status).toBe('active');

      // Track for cleanup
      testUserIds.push(response.body.id);
    });

    it('should return 403 for non-super_admin users', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          email: 'unauthorized@test.com',
          password: 'Password123',
          name: 'Unauthorized',
          role: 'user',
        })
        .expect(403);
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          password: 'Password123',
          name: 'Test',
          role: 'user',
        })
        .expect(400);

      expect(response.body.message || response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: 'invalid-email',
          password: 'Password123',
          name: 'Test',
          role: 'user',
        })
        .expect(400);

      expect(response.body.message || response.body.errors).toBeDefined();
    });

    it('should return 409 for duplicate email', async () => {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: 'superadmin-api-be006@test.com', // Already exists
          password: 'Password123',
          name: 'Duplicate',
          role: 'user',
        })
        .expect(409);
    });

    it('should return 400 for password too short', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: 'shortpass-api@test.com',
          password: 'short',
          name: 'Test',
          role: 'user',
        })
        .expect(400);

      expect(response.body.message || response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid role', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: 'badrole-api@test.com',
          password: 'Password123',
          name: 'Test',
          role: 'invalid_role',
        })
        .expect(400);

      expect(response.body.message || response.body.errors).toBeDefined();
    });
  });

  describe('PUT /api/users/:id', () => {
    let userToUpdateId: string;

    beforeAll(async () => {
      // Create a user to update
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: `to-update-${Date.now()}@test.com`,
          password: 'Password123',
          name: 'To Update',
          role: 'user',
        });

      userToUpdateId = response.body.id;
      testUserIds.push(userToUpdateId);
    });

    it('should update user role', async () => {
      const response = await request(app)
        .put(`/api/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'manager' })
        .expect(200);

      expect(response.body.role).toBe('manager');
    });

    it('should update user status', async () => {
      const response = await request(app)
        .put(`/api/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'inactive' })
        .expect(200);

      expect(response.body.status).toBe('inactive');
    });

    it('should update user name', async () => {
      const response = await request(app)
        .put(`/api/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
    });

    it('should return 403 for non-super_admin users', async () => {
      await request(app)
        .put(`/api/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ role: 'admin' })
        .expect(403);
    });

    it('should return 403 for self-modification of role', async () => {
      await request(app)
        .put(`/api/users/${superAdminId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'admin' })
        .expect(403);
    });

    it('should return 403 for self-modification of status', async () => {
      await request(app)
        .put(`/api/users/${superAdminId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ status: 'inactive' })
        .expect(403);
    });

    it('should allow self-modification of name', async () => {
      const response = await request(app)
        .put(`/api/users/${superAdminId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ name: 'Updated Super Admin' })
        .expect(200);

      expect(response.body.name).toBe('Updated Super Admin');
    });

    it('should return 404 for non-existent user', async () => {
      await request(app)
        .put('/api/users/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'admin' })
        .expect(404);
    });

    it('should return 409 for duplicate email', async () => {
      await request(app)
        .put(`/api/users/${userToUpdateId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ email: 'superadmin-api-be006@test.com' })
        .expect(409);
    });
  });

  describe('DELETE /api/users/:id', () => {
    let userToDeleteId: string;

    beforeEach(async () => {
      // Create a user to delete for each test
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({
          email: `to-delete-${Date.now()}@test.com`,
          password: 'Password123',
          name: 'To Delete',
          role: 'user',
        });

      userToDeleteId = response.body.id;
      testUserIds.push(userToDeleteId);
    });

    it('should soft delete user', async () => {
      const response = await request(app)
        .delete(`/api/users/${userToDeleteId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.id).toBe(userToDeleteId);
      expect(response.body.deletedAt).toBeDefined();

      // Verify user is excluded from list
      const listResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(listResponse.body.users.find((u: { id: string }) => u.id === userToDeleteId)).toBeUndefined();
    });

    it('should return 403 for non-super_admin users', async () => {
      await request(app)
        .delete(`/api/users/${userToDeleteId}`)
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(403);
    });

    it('should return 403 for self-deletion', async () => {
      await request(app)
        .delete(`/api/users/${superAdminId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent user', async () => {
      await request(app)
        .delete('/api/users/non-existent-id')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });

    it('should be idempotent for already deleted user', async () => {
      // First delete
      const firstResponse = await request(app)
        .delete(`/api/users/${userToDeleteId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      // Second delete should return same deletedAt
      const secondResponse = await request(app)
        .delete(`/api/users/${userToDeleteId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(firstResponse.body.deletedAt).toBe(secondResponse.body.deletedAt);
    });
  });

  describe('GET /api/roles', () => {
    it('should list roles for any authenticated user', async () => {
      const response = await request(app)
        .get('/api/users/roles')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('roles');
      expect(Array.isArray(response.body.roles)).toBe(true);
      expect(response.body.roles.length).toBe(4); // 4 roles

      // Check structure
      const role = response.body.roles[0];
      expect(role).toHaveProperty('id');
      expect(role).toHaveProperty('label');
      expect(role).toHaveProperty('description');
      expect(role).toHaveProperty('permissions');
    });

    it('should work for super_admin too', async () => {
      const response = await request(app)
        .get('/api/users/roles')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.roles.length).toBe(4);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app).get('/api/users/roles').expect(401);
    });
  });
});
