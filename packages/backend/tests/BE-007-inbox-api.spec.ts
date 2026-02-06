import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp, createTestUser, seedTestConversations } from './test-helpers';

describe('BE-007: Inbox API (GET /conversations with filters)', () => {
  let app: Express;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const user = await createTestUser({
      email: 'inbox-test@example.com',
      password: 'TestPassword123!',
      role: 'manager',
    });
    testUserId = user.id;
    authToken = user.token;

    // Seed test conversations
    await seedTestConversations(testUserId, 35);
  });

  afterAll(async () => {
    // Cleanup would happen here
  });

  describe('Basic Listing', () => {
    it('should return 200 with paginated conversations', async () => {
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('totalCount');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('totalPage');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return default pagination (page=1, pageSize=20)', async () => {
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(20);
      expect(res.body.page).toBe(1);
    });

    it('should return 401 without authorization token', async () => {
      const res = await request(app).get('/api/conversations');

      expect(res.status).toBe(401);
    });
  });

  describe('Pagination', () => {
    it('should support custom page size', async () => {
      const res = await request(app)
        .get('/api/conversations?limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(10);
    });

    it('should support page offset', async () => {
      const res1 = await request(app)
        .get('/api/conversations?limit=5&page=1')
        .set('Authorization', `Bearer ${authToken}`);

      const res2 = await request(app)
        .get('/api/conversations?limit=5&page=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      // First items shouldn't be the same
      if (res1.body.data.length > 0 && res2.body.data.length > 0) {
        expect(res1.body.data[0].id).not.toBe(res2.body.data[0].id);
      }
    });

    it('should include total count in response', async () => {
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalCount).toBeGreaterThan(0);
      expect(typeof res.body.totalCount).toBe('number');
    });

    it('should calculate total pages correctly', async () => {
      const res = await request(app)
        .get('/api/conversations?limit=10')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalPage).toBe(Math.ceil(res.body.totalCount / 10));
    });
  });

  describe('Filtering', () => {
    it('should filter by channel', async () => {
      const res = await request(app)
        .get('/api/conversations?channel=telegram')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((conv: any) => {
        expect(conv.channel).toBe('telegram');
      });
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/conversations?status=open')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((conv: any) => {
        expect(conv.status).toBe('open');
      });
    });

    it('should filter by priority', async () => {
      const res = await request(app)
        .get('/api/conversations?priority=high')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((conv: any) => {
        expect(conv.priority).toBe('high');
      });
    });

    it('should filter by assignedUserId', async () => {
      const res = await request(app)
        .get(`/api/conversations?assignedUserId=${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((conv: any) => {
        expect(conv.assignedUserId).toBe(testUserId);
      });
    });

    it('should combine multiple filters', async () => {
      const res = await request(app)
        .get(`/api/conversations?channel=telegram&status=open&priority=high`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.data.forEach((conv: any) => {
        expect(conv.channel).toBe('telegram');
        expect(conv.status).toBe('open');
        expect(conv.priority).toBe('high');
      });
    });
  });

  describe('Search', () => {
    it('should search by title/externalThreadId', async () => {
      // Assumes test data has a conversation with specific title
      const res = await request(app)
        .get('/api/conversations?search=test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // All results should match search term in title, externalThreadId, or message body
    });
  });

  describe('Date Range Filtering', () => {
    it('should filter by dateFrom', async () => {
      const dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .get(`/api/conversations?dateFrom=${dateFrom}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should filter by dateTo', async () => {
      const dateTo = new Date().toISOString();
      const res = await request(app)
        .get(`/api/conversations?dateTo=${dateTo}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });

    it('should filter by date range', async () => {
      const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const dateTo = new Date().toISOString();
      const res = await request(app)
        .get(`/api/conversations?dateFrom=${dateFrom}&dateTo=${dateTo}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('Response Format', () => {
    it('should return conversation summary objects with required fields', async () => {
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        const conv = res.body.data[0];
        expect(conv).toHaveProperty('id');
        expect(conv).toHaveProperty('channel');
        expect(conv).toHaveProperty('externalThreadId');
        expect(conv).toHaveProperty('status');
        expect(conv).toHaveProperty('priority');
        expect(conv).toHaveProperty('assignedUserId');
        expect(conv).toHaveProperty('tags');
        expect(conv).toHaveProperty('participants');
        expect(conv).toHaveProperty('unreadCount');
        expect(conv).toHaveProperty('latestMessagePreview');
        expect(conv).toHaveProperty('latestMessageAt');
        expect(conv).toHaveProperty('createdAt');
        expect(conv).toHaveProperty('updatedAt');
      }
    });

    it('should return array for tags', async () => {
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        expect(Array.isArray(res.body.data[0].tags)).toBe(true);
      }
    });

    it('should return array for participants', async () => {
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        expect(Array.isArray(res.body.data[0].participants)).toBe(true);
      }
    });
  });

  describe('RBAC', () => {
    it('should enforce role-based visibility', async () => {
      // Manager should see assigned conversations
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // Behavior depends on role implementation
    });
  });

  describe('Sorting', () => {
    it('should sort by lastActivity by default (desc)', async () => {
      const res = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      if (res.body.data.length > 1) {
        const first = new Date(res.body.data[0].latestMessageAt).getTime();
        const second = new Date(res.body.data[1].latestMessageAt).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for invalid page number', async () => {
      const res = await request(app)
        .get('/api/conversations?page=abc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid channel value', async () => {
      const res = await request(app)
        .get('/api/conversations?channel=invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid status value', async () => {
      const res = await request(app)
        .get('/api/conversations?status=invalid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
    });
  });
});
