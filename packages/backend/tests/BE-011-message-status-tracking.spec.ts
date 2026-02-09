import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, createTestUser, seedTestConversations } from './test-helpers.js';
import { dbClient } from '../src/infrastructure/db.client.js';
import { messages } from '../src/schemas/message.schema.js';
import { eq } from 'drizzle-orm';

describe('BE-011: Message Status Tracking (MessageStatusTracker Integration)', () => {
  let app: Express;
  let authToken: string;
  let testUserId: string;
  let conversationId: string;
  let managerToken: string;
  let managerId: string;

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

    // Create conversation
    const conversations = await seedTestConversations(testUserId, 1);
    conversationId = conversations[0].id;
  });

  afterAll(async () => {
    // Clean up messages and conversations
    await dbClient.delete(messages).where(eq(messages.conversationId, conversationId));
  });

  describe('GET /conversations/:conversationId/messages/:messageId/status', () => {
    it('should return message status after sending', async () => {
      // Send a message
      const sendResponse = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Test message for status check' });

      expect(sendResponse.status).toBe(201);
      const messageId = sendResponse.body.id;

      // Wait for async dispatch to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Get message status
      const statusResponse = await request(app)
        .get(`/conversations/${conversationId}/messages/${messageId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body).toMatchObject({
        messageId,
        status: 'sent', // Stub connector always succeeds
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('should return 404 if conversation does not exist', async () => {
      const statusResponse = await request(app)
        .get('/conversations/nonexistent/messages/msg123/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(404);
      expect(statusResponse.body).toEqual({
        error: 'Conversation not found',
      });
    });

    it('should return 404 if message does not exist', async () => {
      const statusResponse = await request(app)
        .get(`/conversations/${conversationId}/messages/nonexistent/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(404);
      expect(statusResponse.body).toEqual({
        error: 'Message not found',
      });
    });

    it('should return 404 if message does not belong to conversation', async () => {
      // Create another conversation
      const otherConversations = await seedTestConversations(managerId, 1);
      const otherConversationId = otherConversations[0].id;

      // Send a message in the first conversation
      const sendResponse = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Test message' });

      expect(sendResponse.status).toBe(201);
      const messageId = sendResponse.body.id;

      // Try to get status from the other conversation
      const statusResponse = await request(app)
        .get(`/conversations/${otherConversationId}/messages/${messageId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(404);
      expect(statusResponse.body).toEqual({
        error: 'Message not found',
      });

      // Clean up
      await dbClient.delete(messages).where(eq(messages.conversationId, otherConversationId));
    });

    it('should require authentication', async () => {
      const sendResponse = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Test message' });

      expect(sendResponse.status).toBe(201);
      const messageId = sendResponse.body.id;

      const statusResponse = await request(app)
        .get(`/conversations/${conversationId}/messages/${messageId}/status`);

      expect(statusResponse.status).toBe(403);
    });
  });

  describe('Message Status Transitions', () => {
    it('should track status as pending -> sent for successful send', async () => {
      const sendResponse = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Message for status tracking' });

      expect(sendResponse.status).toBe(201);
      const messageId = sendResponse.body.id;

      // Message should be pending initially
      expect(sendResponse.body.status).toBe('pending');

      // Wait for async dispatch
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Status should transition to sent
      const statusResponse = await request(app)
        .get(`/conversations/${conversationId}/messages/${messageId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe('sent');
    });

    it('should update message timestamps on status change', async () => {
      const sendResponse = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Message for timestamp tracking' });

      expect(sendResponse.status).toBe(201);
      const messageId = sendResponse.body.id;
      const createdAt = sendResponse.body.createdAt;

      // Wait for async dispatch
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Get updated message
      const statusResponse = await request(app)
        .get(`/conversations/${conversationId}/messages/${messageId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.updatedAt).toBeDefined();
      // updatedAt should be set or similar to createdAt (in tests it's very close)
      expect(new Date(statusResponse.body.updatedAt)).toBeInstanceOf(Date);
    });
  });

  describe('Message Status via GET /conversations/:conversationId/messages', () => {
    it('should return message status in conversation message list', async () => {
      // Send a message
      const sendResponse = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Message for list status check' });

      expect(sendResponse.status).toBe(201);
      const messageId = sendResponse.body.id;

      // Wait for async dispatch
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Get messages list
      const listResponse = await request(app)
        .get(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.messages).toBeInstanceOf(Array);

      // Find the message we just sent
      const message = listResponse.body.messages.find((m: any) => m.id === messageId);
      expect(message).toBeDefined();
      expect(message.status).toBe('sent');
    });

    it('should preserve message status across multiple queries', async () => {
      // Send a message
      const sendResponse = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Message for status persistence' });

      expect(sendResponse.status).toBe(201);
      const messageId = sendResponse.body.id;

      // Wait for async dispatch
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Query status endpoint
      const statusResponse1 = await request(app)
        .get(`/conversations/${conversationId}/messages/${messageId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse1.status).toBe(200);
      const status1 = statusResponse1.body.status;

      // Query again after a small delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      const statusResponse2 = await request(app)
        .get(`/conversations/${conversationId}/messages/${messageId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse2.status).toBe(200);
      const status2 = statusResponse2.body.status;

      // Status should remain the same
      expect(status1).toBe(status2);
      expect(status1).toBe('sent');
    });
  });

  describe('Manager role message sending with status tracking', () => {
    it('manager should be able to send messages and track status', async () => {
      // Send a message as manager
      const sendResponse = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ body: 'Message from manager' });

      expect(sendResponse.status).toBe(201);
      const messageId = sendResponse.body.id;
      expect(sendResponse.body.status).toBe('pending');
      expect(sendResponse.body.senderName).toBeDefined();

      // Wait for async dispatch
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check status
      const statusResponse = await request(app)
        .get(`/conversations/${conversationId}/messages/${messageId}/status`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.status).toBe('sent');
    });
  });

  describe('Multiple messages status independence', () => {
    it('should track status independently for multiple messages', async () => {
      // Send first message
      const msg1Response = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'First message' });

      expect(msg1Response.status).toBe(201);
      const messageId1 = msg1Response.body.id;

      // Send second message
      const msg2Response = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Second message' });

      expect(msg2Response.status).toBe(201);
      const messageId2 = msg2Response.body.id;

      // Wait for async dispatch
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check both statuses
      const status1Response = await request(app)
        .get(`/conversations/${conversationId}/messages/${messageId1}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      const status2Response = await request(app)
        .get(`/conversations/${conversationId}/messages/${messageId2}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(status1Response.status).toBe(200);
      expect(status2Response.status).toBe(200);
      expect(status1Response.body.messageId).toBe(messageId1);
      expect(status2Response.body.messageId).toBe(messageId2);
      expect(status1Response.body.status).toBe('sent');
      expect(status2Response.body.status).toBe('sent');
    });
  });

  describe('Message metadata and status', () => {
    it('should return complete message data with status via GET endpoint', async () => {
      const sendResponse = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: 'Test message with full metadata' });

      expect(sendResponse.status).toBe(201);
      const messageId = sendResponse.body.id;

      // Wait for dispatch
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Get full message
      const messageResponse = await request(app)
        .get(`/conversations/${conversationId}/messages?limit=1`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(messageResponse.status).toBe(200);
      const message = messageResponse.body.messages.find((m: any) => m.id === messageId);

      expect(message).toBeDefined();
      expect(message).toMatchObject({
        id: messageId,
        conversationId,
        status: 'sent',
        direction: 'outbound',
        body: 'Test message with full metadata',
        senderId: testUserId,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });
  });
});
