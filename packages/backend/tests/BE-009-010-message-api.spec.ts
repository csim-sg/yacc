import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp, createTestUser, seedTestConversations } from './test-helpers.js';
import { dbClient } from '../src/infrastructure/db.client.js';
import { messages } from '../src/schemas/message.schema.js';
import { eq } from 'drizzle-orm';

describe('BE-009/010: Message API (GET /conversations/:id/messages, POST /conversations/:id/messages)', () => {
  let app: Express;
  let authToken: string;
  let testUserId: string;
  let conversationId: string;
  let managerToken: string;
  let managerId: string;
  let adminToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Create test users
    const userResult = await createTestUser(app, {
      email: 'user@yacc.local',
      password: 'test123',
      role: 'user',
    });
    testUserId = userResult.id;
    authToken = userResult.token;

    const managerResult = await createTestUser(app, {
      email: 'manager@yacc.local',
      password: 'test123',
      role: 'manager',
    });
    managerId = managerResult.id;
    managerToken = managerResult.token;

    const adminResult = await createTestUser(app, {
      email: 'admin@yacc.local',
      password: 'test123',
      role: 'admin',
    });
    adminToken = adminResult.token;

    // Create conversation
    const conversations = await seedTestConversations(testUserId, 1);
    conversationId = conversations[0].id;
  });

  afterAll(async () => {
    // Cleanup
    if (conversationId) {
      await dbClient.delete(messages).where(eq(messages.conversationId, conversationId));
    }
  });

  describe('GET /conversations/:id/messages - Message Retrieval', () => {
    it('should return 401 without authorization token', async () => {
      const res = await request(app).get(`/conversations/${conversationId}/messages`);

      expect(res.status).toBe(401);
    });

    it('should return empty messages for new conversation', async () => {
      const res = await request(app)
        .get(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.messages).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(50);
    });

    it('should return 404 for non-existent conversation', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .get(`/conversations/${fakeId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Conversation not found');
    });

    it('should return 400 for invalid page parameter', async () => {
      const res = await request(app)
        .get(`/conversations/${conversationId}/messages?page=invalid`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('page');
    });

    it('should return 400 for invalid limit parameter', async () => {
      const res = await request(app)
        .get(`/conversations/${conversationId}/messages?limit=150`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('limit');
    });

    it('should return 400 for invalid direction parameter', async () => {
      const res = await request(app)
        .get(`/conversations/${conversationId}/messages?direction=invalid`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('direction');
    });

    it('should support pagination with custom page and limit', async () => {
      // Create 15 messages
      for (let i = 0; i < 15; i++) {
        await dbClient.insert(messages).values({
          conversationId,
          senderId: testUserId,
          senderName: 'Test User',
          body: `Test message ${i}`,
          status: 'sent',
          direction: 'inbound',
        });
      }

      const res = await request(app)
        .get(`/conversations/${conversationId}/messages?page=1&limit=5`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.messages.length).toBe(5);
      expect(res.body.total).toBe(15);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(5);

      // Test page 2
      const res2 = await request(app)
        .get(`/conversations/${conversationId}/messages?page=2&limit=5`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res2.status).toBe(200);
      expect(res2.body.messages.length).toBe(5);
      expect(res2.body.messages[0].id).not.toBe(res.body.messages[0].id);
    });

    it('should filter messages by direction', async () => {
      // Create inbound and outbound messages
      const inbound = await dbClient
        .insert(messages)
        .values({
          conversationId,
          senderId: null,
          senderName: 'External User',
          body: 'Inbound message',
          status: 'sent',
          direction: 'inbound',
        })
        .returning();

      const outbound = await dbClient
        .insert(messages)
        .values({
          conversationId,
          senderId: testUserId,
          senderName: 'Test User',
          body: 'Outbound message',
          status: 'sent',
          direction: 'outbound',
        })
        .returning();

      const inboundRes = await request(app)
        .get(`/conversations/${conversationId}/messages?direction=inbound`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(inboundRes.status).toBe(200);
      const inboundMessages = inboundRes.body.messages;
      expect(inboundMessages.every((m: any) => m.direction === 'inbound')).toBe(true);

      const outboundRes = await request(app)
        .get(`/conversations/${conversationId}/messages?direction=outbound`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(outboundRes.status).toBe(200);
      const outboundMessages = outboundRes.body.messages;
      expect(outboundMessages.every((m: any) => m.direction === 'outbound')).toBe(true);
    });

    it('should return messages ordered chronologically (oldest first)', async () => {
      const res = await request(app)
        .get(`/conversations/${conversationId}/messages?limit=100`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      const msgs = res.body.messages;

      // Verify chronological order
      for (let i = 1; i < msgs.length; i++) {
        const prevTime = new Date(msgs[i - 1].createdAt).getTime();
        const currTime = new Date(msgs[i].createdAt).getTime();
        expect(prevTime).toBeLessThanOrEqual(currTime);
      }
    });
  });

  describe('POST /conversations/:id/messages - Message Sending', () => {
    it('should return 401 without authorization token', async () => {
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .send({ body: 'Test message' });

      expect(res.status).toBe(401);
    });

    it('should send a message successfully as user', async () => {
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Hello, World!' });

      expect(res.status).toBe(201);
      expect(res.body.body).toBe('Hello, World!');
      expect(res.body.status).toBe('sent'); // Stub connector marks as sent immediately
      expect(res.body.direction).toBe('outbound');
      expect(res.body.senderId).toBe(testUserId);
      expect(res.body.conversationId).toBe(conversationId);
      expect(res.body.createdAt).toBeDefined();
      expect(res.body.updatedAt).toBeDefined();
    });

    it('should send a message successfully as manager', async () => {
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ body: 'Manager message' });

      expect(res.status).toBe(201);
      expect(res.body.body).toBe('Manager message');
      expect(res.body.senderId).toBe(managerId);
    });

    it('should reject empty message body', async () => {
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('required');
    });

    it('should reject message exceeding max length (10000 chars)', async () => {
      const longBody = 'a'.repeat(10001);
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: longBody });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('exceeds');
    });

    it('should accept message at max length boundary (10000 chars)', async () => {
      const maxBody = 'a'.repeat(10000);
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: maxBody });

      expect(res.status).toBe(201);
      expect(res.body.body.length).toBe(10000);
    });

    it('should return 404 for non-existent conversation', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post(`/conversations/${fakeId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Test message' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Conversation not found');
    });

    it('should reject admin user from sending messages (role-based access control)', async () => {
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ body: 'Admin message' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('users and managers');
    });

    it('should reject message with missing body', async () => {
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid request body');
    });

    it('should persist message to database', async () => {
      const sendRes = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Persisted message' });

      expect(sendRes.status).toBe(201);
      const messageId = sendRes.body.id;

      // Verify message exists in database
      const dbMessage = await dbClient.query.messages.findFirst({
        where: eq(messages.id, messageId),
      });

      expect(dbMessage).toBeDefined();
      expect(dbMessage?.body).toBe('Persisted message');
      expect(dbMessage?.conversationId).toBe(conversationId);
      expect(dbMessage?.status).toBe('sent');
      expect(dbMessage?.direction).toBe('outbound');
    });

    it('should handle concurrent message sends', async () => {
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .post(`/conversations/${conversationId}/messages`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ body: `Concurrent message ${i}` })
        );
      }

      const results = await Promise.all(promises);

      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(results.map((r) => r.body.id).every((id) => id)).toBe(true);

      // Verify all messages were persisted
      const msgRes = await request(app)
        .get(`/conversations/${conversationId}/messages?limit=100`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(msgRes.body.total).toBeGreaterThanOrEqual(5);
    });

    it('should set sender name from user email', async () => {
      const res = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Message with sender name' });

      expect(res.status).toBe(201);
      expect(res.body.senderName).toBeDefined();
      expect(res.body.senderName).not.toBe('');
    });
  });
});
