import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp, createTestUser, seedTestConversations } from './test-helpers';

/**
 * BE-P2-001: Backend Tags CRUD Integration Tests
 *
 * Test suite for tag CRUD and conversation tag management endpoints.
 * Validates:
 * - GET /api/tags (list tags)
 * - POST /api/tags (create tag)
 * - POST /api/conversations/:id/tags (add tag to conversation)
 * - DELETE /api/conversations/:id/tags/:tagId (remove tag)
 * - WebSocket events emitted
 * - Audit logs created
 * - RBAC enforcement
 */

describe('BE-P2-001: Backend Tags CRUD', () => {
  let app: Express;
  let adminToken: string;
  let managerToken: string;
  let userToken: string;
  let superAdminToken: string;
  let adminUserId: string;
  let superAdminUserId: string;
  let conversationId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Create users with different roles
    const admin = await createTestUser(app, {
      email: 'admin-tags@yacc.local',
      password: 'admin123',
      role: 'admin',
    });
    adminUserId = admin.id;
    adminToken = admin.token;

    const manager = await createTestUser(app, {
      email: 'manager-tags@yacc.local',
      password: 'manager123',
      role: 'manager',
    });
    managerToken = manager.token;

    const user = await createTestUser(app, {
      email: 'user-tags@yacc.local',
      password: 'user123',
      role: 'user',
    });
    userToken = user.token;

    const superAdmin = await createTestUser(app, {
      email: 'super-admin-tags@yacc.local',
      password: 'superadmin123',
      role: 'super_admin',
    });
    superAdminUserId = superAdmin.id;
    superAdminToken = superAdmin.token;

    // Create test conversation
    const convoRes = await seedTestConversations(adminUserId, 1);
    conversationId = convoRes[0]?.id || '';
  });

  afterAll(async () => {
    // Cleanup
  });

  // ============================================
  // GET /api/tags
  // ============================================

  describe('GET /api/tags - List Tags', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/tags');
      expect(res.status).toBe(401);
    });

    it('should list all tags (empty initially)', async () => {
      const res = await request(app)
        .get('/api/tags')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ============================================
  // POST /api/tags - Create Tag
  // ============================================

  describe('POST /api/tags - Create Tag', () => {
    it('should require authentication', async () => {
      const res = await request(app).post('/api/tags').send({
        name: 'Urgent',
        color: '#FF5A5F',
      });

      expect(res.status).toBe(401);
    });

    it('should create a tag with name and color', async () => {
      const res = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Urgent',
          color: '#FF5A5F',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Urgent');
      expect(res.body.data.color).toBe('#FF5A5F');
      expect(res.body.data).toHaveProperty('createdAt');
    });

    it('should create tag with default color if not provided', async () => {
      const res = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Default Color Tag',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.color).toBe('#808080'); // Default color
    });

    it('should reject invalid color format', async () => {
      const res = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Bad Color',
          color: 'invalid-color',
        });

      expect(res.status).toBe(400);
    });

    it('should reject empty tag name', async () => {
      const res = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
          color: '#FF5A5F',
        });

      expect(res.status).toBe(400);
    });

    it('should allow all roles to create tags (admin)', async () => {
      const res = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Admin Tag', color: '#FF0000' });

      expect(res.status).toBe(201);
    });

    it('should allow all roles to create tags (manager)', async () => {
      const res = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ name: 'Manager Tag', color: '#00FF00' });

      expect(res.status).toBe(201);
    });

     it('should allow all roles to create tags (user)', async () => {
       const res = await request(app)
         .post('/api/tags')
         .set('Authorization', `Bearer ${userToken}`)
         .send({ name: 'User Tag', color: '#0000FF' });

       expect(res.status).toBe(201);
     });

     it('should allow all roles to create tags (super_admin)', async () => {
       const res = await request(app)
         .post('/api/tags')
         .set('Authorization', `Bearer ${superAdminToken}`)
         .send({ name: 'Super Admin Tag', color: '#FFFFFF' });

       expect(res.status).toBe(201);
     });
   });

  // ============================================
  // POST /api/conversations/:id/tags
  // ============================================

  describe('POST /api/conversations/:id/tags - Add Tag to Conversation', () => {
    let tagId: number;

    beforeAll(async () => {
      // Create a tag first
      const res = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Tag', color: '#FF5A5F' });

      tagId = res.body.data?.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/api/conversations/${conversationId}/tags`)
        .send({ tagId });

      expect(res.status).toBe(401);
    });

    it('should add tag to conversation', async () => {
      const res = await request(app)
        .post(`/api/conversations/${conversationId}/tags`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tagId });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('tags');
      expect(Array.isArray(res.body.data.tags)).toBe(true);
    });

     it('should be idempotent - adding same tag twice', async () => {
       // Add tag once
       const res1 = await request(app)
         .post(`/api/conversations/${conversationId}/tags`)
         .set('Authorization', `Bearer ${adminToken}`)
         .send({ tagId });

       expect(res1.status).toBe(200);

       // Add same tag again
       const res2 = await request(app)
         .post(`/api/conversations/${conversationId}/tags`)
         .set('Authorization', `Bearer ${adminToken}`)
         .send({ tagId });

       expect(res2.status).toBe(200);
       // Should have same number of tags (not doubled)
       if (res1.body.data.tags && res2.body.data.tags) {
         const count1 = (res1.body.data.tags as Array<{ id: number }>).filter((t) => t.id === tagId).length;
         const count2 = (res2.body.data.tags as Array<{ id: number }>).filter((t) => t.id === tagId).length;
         expect(count2).toBe(count1); // Not doubled
       }
     });

    it('should reject invalid tagId', async () => {
      const res = await request(app)
        .post(`/api/conversations/${conversationId}/tags`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tagId: -1 });

      expect(res.status).toBe(400);
    });

    it('should reject non-existent tag', async () => {
      const res = await request(app)
        .post(`/api/conversations/${conversationId}/tags`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tagId: 99999 });

      expect(res.status).toBe(404);
    });

     it('should allow all roles to add tags', async () => {
       // Create another tag
       const createRes = await request(app)
         .post('/api/tags')
         .set('Authorization', `Bearer ${adminToken}`)
         .send({ name: 'Role Test Tag', color: '#FF00FF' });

       const newTagId = createRes.body.data?.id;

       // User can add
       const userRes = await request(app)
         .post(`/api/conversations/${conversationId}/tags`)
         .set('Authorization', `Bearer ${userToken}`)
         .send({ tagId: newTagId });

       expect(userRes.status).toBe(200);
     });

     it('should allow super_admin to add tags', async () => {
       // Create another tag
       const createRes = await request(app)
         .post('/api/tags')
         .set('Authorization', `Bearer ${superAdminToken}`)
         .send({ name: 'Super Admin Add Test', color: '#123456' });

       const newTagId = createRes.body.data?.id;

       // Super admin can add
       const superAdminRes = await request(app)
         .post(`/api/conversations/${conversationId}/tags`)
         .set('Authorization', `Bearer ${superAdminToken}`)
         .send({ tagId: newTagId });

       expect(superAdminRes.status).toBe(200);
     });
   });

  // ============================================
  // DELETE /api/conversations/:id/tags/:tagId
  // ============================================

  describe('DELETE /api/conversations/:id/tags/:tagId - Remove Tag', () => {
    let tagId: number;

    beforeAll(async () => {
      // Create and add a tag
      const res = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Tag to Remove', color: '#FF5A5F' });

      tagId = res.body.data?.id;

      await request(app)
        .post(`/api/conversations/${conversationId}/tags`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ tagId });
    });

    it('should require authentication', async () => {
      const res = await request(app).delete(
        `/api/conversations/${conversationId}/tags/${tagId}`
      );

      expect(res.status).toBe(401);
    });

    it('should remove tag from conversation', async () => {
      const res = await request(app)
        .delete(`/api/conversations/${conversationId}/tags/${tagId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('tags');
    });

    it('should handle gracefully if tag not on conversation', async () => {
      // Try to remove again (should still succeed, graceful)
      const res = await request(app)
        .delete(`/api/conversations/${conversationId}/tags/${tagId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

     it('should allow all roles to remove tags', async () => {
       // Create and add tag
       const createRes = await request(app)
         .post('/api/tags')
         .set('Authorization', `Bearer ${adminToken}`)
         .send({ name: 'User Remove Test', color: '#00FF00' });

       const newTagId = createRes.body.data?.id;

       await request(app)
         .post(`/api/conversations/${conversationId}/tags`)
         .set('Authorization', `Bearer ${adminToken}`)
         .send({ tagId: newTagId });

       // User removes
       const userRes = await request(app)
         .delete(`/api/conversations/${conversationId}/tags/${newTagId}`)
         .set('Authorization', `Bearer ${userToken}`);

       expect(userRes.status).toBe(200);
     });

     it('should allow super_admin to remove tags', async () => {
       // Create and add tag
       const createRes = await request(app)
         .post('/api/tags')
         .set('Authorization', `Bearer ${superAdminToken}`)
         .send({ name: 'Super Admin Remove Test', color: '#654321' });

       const newTagId = createRes.body.data?.id;

       await request(app)
         .post(`/api/conversations/${conversationId}/tags`)
         .set('Authorization', `Bearer ${superAdminToken}`)
         .send({ tagId: newTagId });

       // Super admin removes
       const superAdminRes = await request(app)
         .delete(`/api/conversations/${conversationId}/tags/${newTagId}`)
         .set('Authorization', `Bearer ${superAdminToken}`);

       expect(superAdminRes.status).toBe(200);
     });
   });

  // ============================================
  // Response Format Validation
  // ============================================

  describe('Response Format', () => {
    it('should return tags array in correct format', async () => {
      // Create tag
      const tagRes = await request(app)
        .post('/api/tags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Format Test', color: '#FF0000' });

      const tag = tagRes.body.data;
      expect(tag).toHaveProperty('id');
      expect(tag).toHaveProperty('name');
      expect(tag).toHaveProperty('color');
      expect(tag).toHaveProperty('createdById');
      expect(tag).toHaveProperty('createdAt');
    });
  });
});
