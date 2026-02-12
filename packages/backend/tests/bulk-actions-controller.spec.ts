/**
 * Bulk Actions Controller Tests
 *
 * Tests for POST /api/conversations/bulk endpoint
 * Covers:
 * - Valid bulk operations (assign, tag, status)
 * - RBAC enforcement (manager+ only)
 * - Input validation
 * - Error responses
 * - Response format
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, createTestUser } from './test-helpers';
import { dbClient } from '../src/infrastructure/db.client';
import { conversations } from '../src/schemas/conversation.schema';
import { tags } from '../src/schemas/tag.schema';

describe('Bulk Actions Controller', () => {
  let app: Express;
  let managerToken: string;
  let userToken: string;
  let managerUserId: string;
  let testConversationIds: string[] = [];
  let testTagId: number;

  beforeAll(async () => {
    // Create test app
    app = await createTestApp();

    // Create manager user
    const managerUser = await createTestUser(app, {
      email: `manager-bulk-${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'manager',
    });
    managerToken = managerUser.token;
    managerUserId = managerUser.id;

    // Create regular user
    const regularUser = await createTestUser(app, {
      email: `user-bulk-${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'user',
    });
    userToken = regularUser.token;

    // Create test conversations
    const convResults = await dbClient
      .insert(conversations)
      .values([
        {
          channel: 'telegram',
          externalThreadId: `bulk-ctrl-1-${Date.now()}`,
          status: 'open',
          priority: 'medium',
        },
        {
          channel: 'telegram',
          externalThreadId: `bulk-ctrl-2-${Date.now()}`,
          status: 'pending',
          priority: 'high',
        },
        {
          channel: 'irc',
          externalThreadId: `bulk-ctrl-3-${Date.now()}`,
          status: 'open',
          priority: 'low',
        },
      ])
      .returning();

    testConversationIds = convResults.map((c) => c.id);

    // Create test tag
    const tagResults = await dbClient
      .insert(tags)
      .values({
        name: `bulk-ctrl-tag-${Date.now()}`,
        color: '#FF5733',
        createdById: managerUserId,
      })
      .returning();

    testTagId = tagResults[0].id;
  });

  describe('POST /api/conversations/bulk', () => {
    describe('Bulk Assign', () => {
      it('should bulk assign conversations for manager', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 2),
            action: 'assign',
            data: { assigneeId: managerUserId },
          });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          successCount: 2,
          failureCount: 0,
          failures: [],
        });
      });

      it('should reject bulk assign for non-manager user', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 2),
            action: 'assign',
            data: { assigneeId: managerUserId },
          });

        expect(response.status).toBe(403);
      });

      it('should reject without authentication', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .send({
            conversationIds: testConversationIds.slice(0, 2),
            action: 'assign',
            data: { assigneeId: managerUserId },
          });

        expect(response.status).toBe(401);
      });

      it('should return partial failures for invalid conversations', async () => {
        const validId = testConversationIds[0];
        const invalidId = `invalid-${Date.now()}`;

        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: [validId, invalidId],
            action: 'assign',
            data: { assigneeId: managerUserId },
          });

        expect(response.status).toBe(200);
        expect(response.body.successCount).toBe(1);
        expect(response.body.failureCount).toBe(1);
        expect(response.body.failures).toHaveLength(1);
        expect(response.body.failures[0].id).toBe(invalidId);
      });
    });

    describe('Bulk Tag', () => {
      it('should bulk tag conversations', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 2),
            action: 'tag',
            data: { tagId: testTagId },
          });

        expect(response.status).toBe(200);
        expect(response.body.successCount).toBe(2);
        expect(response.body.failureCount).toBe(0);
      });

      it('should reject invalid tag ID (not a number)', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 2),
            action: 'tag',
            data: { tagId: 'not-a-number' },
          });

        expect(response.status).toBe(400);
      });

      it('should reject for non-existent tag', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 2),
            action: 'tag',
            data: { tagId: 99999 },
          });

        expect(response.status).toBe(200);
        expect(response.body.successCount).toBe(0);
        expect(response.body.failureCount).toBe(2);
        expect(response.body.failures[0].reason).toContain('Tag not found');
      });
    });

    describe('Bulk Status Update', () => {
      it('should bulk update conversation status', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 2),
            action: 'status',
            data: { status: 'resolved' },
          });

        expect(response.status).toBe(200);
        expect(response.body.successCount).toBe(2);
        expect(response.body.failureCount).toBe(0);
      });

      it('should reject invalid status value', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 2),
            action: 'status',
            data: { status: 'invalid_status' },
          });

        expect(response.status).toBe(400);
      });

      it('should accept valid status values', async () => {
        const statuses = ['open', 'pending', 'resolved'];

        for (const status of statuses) {
          const response = await request(app)
            .post('/api/conversations/bulk')
            .set('Authorization', `Bearer ${managerToken}`)
            .send({
              conversationIds: [testConversationIds[0]],
              action: 'status',
              data: { status },
            });

          expect(response.status).toBe(200);
          expect(response.body.successCount).toBe(1);
        }
      });
    });

    describe('Input Validation', () => {
       it('should reject missing conversationIds', async () => {
         const response = await request(app)
           .post('/api/conversations/bulk')
           .set('Authorization', `Bearer ${managerToken}`)
           .send({
             action: 'assign',
             data: { assigneeId: managerUserId },
           });

         expect(response.status).toBe(400);
       });

       it('should reject non-array conversationIds', async () => {
         const response = await request(app)
           .post('/api/conversations/bulk')
           .set('Authorization', `Bearer ${managerToken}`)
           .send({
             conversationIds: 'not-an-array',
             action: 'assign',
             data: { assigneeId: managerUserId },
           });

         expect(response.status).toBe(400);
       });

       it('should reject empty conversationIds array', async () => {
         const response = await request(app)
           .post('/api/conversations/bulk')
           .set('Authorization', `Bearer ${managerToken}`)
           .send({
             conversationIds: [],
             action: 'assign',
             data: { assigneeId: managerUserId },
           });

         expect(response.status).toBe(400);
       });

       it('should reject more than 100 conversations', async () => {
         const tooMany = Array.from({ length: 101 }, (_, i) => `conv-${i}`);

         const response = await request(app)
           .post('/api/conversations/bulk')
           .set('Authorization', `Bearer ${managerToken}`)
           .send({
             conversationIds: tooMany,
             action: 'assign',
             data: { assigneeId: managerUserId },
           });

         expect(response.status).toBe(400);
       });

      it('should reject missing action', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 2),
            data: { assigneeId: 'someone' },
          });

        expect(response.status).toBe(400);
      });

      it('should reject invalid action', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 2),
            action: 'invalid_action',
            data: { assigneeId: 'someone' },
          });

        expect(response.status).toBe(400);
      });

      it('should reject missing data', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 2),
            action: 'assign',
          });

        expect(response.status).toBe(400);
      });
    });

    describe('Response Format', () => {
      it('should return consistent response structure', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 1),
            action: 'status',
            data: { status: 'open' },
          });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          successCount: expect.any(Number),
          failureCount: expect.any(Number),
          failures: expect.any(Array),
        });
      });

      it('failures should contain id and reason', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            conversationIds: [`invalid-${Date.now()}`],
            action: 'assign',
            data: { assigneeId: 'someone' },
          });

        expect(response.status).toBe(200);
        expect(response.body.failures).toHaveLength(1);
        expect(response.body.failures[0]).toEqual({
          id: expect.any(String),
          reason: expect.any(String),
        });
      });
    });

    describe('RBAC Enforcement', () => {
      it('should allow admin to bulk assign', async () => {
        const adminUser = await createTestUser(app, {
          email: `admin-bulk-${Date.now()}@test.com`,
          password: 'Password123!',
          role: 'admin',
        });

        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${adminUser.token}`)
          .send({
            conversationIds: testConversationIds.slice(0, 1),
            action: 'assign',
            data: { assigneeId: 'someone' },
          });

        expect(response.status).toBe(200);
      });

      it('should allow super_admin to bulk assign', async () => {
        const superAdminUser = await createTestUser(app, {
          email: `super-admin-bulk-${Date.now()}@test.com`,
          password: 'Password123!',
          role: 'super_admin',
        });

        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${superAdminUser.token}`)
          .send({
            conversationIds: testConversationIds.slice(0, 1),
            action: 'assign',
            data: { assigneeId: 'someone' },
          });

        expect(response.status).toBe(200);
      });

      it('should reject user role for bulk operations', async () => {
        const response = await request(app)
          .post('/api/conversations/bulk')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            conversationIds: testConversationIds.slice(0, 1),
            action: 'assign',
            data: { assigneeId: 'someone' },
          });

        expect(response.status).toBe(403);
      });
    });
  });
});
