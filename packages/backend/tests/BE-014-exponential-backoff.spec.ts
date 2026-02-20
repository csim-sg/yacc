import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { dbClient } from '../src/infrastructure/db.client.js';
import { messages } from '../src/schemas/message.schema.js';
import { deadLetterQueue } from '../src/schemas/deadLetterQueue.schema.js';
import { eq } from 'drizzle-orm';
import { dlqService } from '../src/services/dlq.service.js';
import { createTestApp, createTestUser, seedTestConversations } from './test-helpers.js';
import type { Express } from 'express';

describe('BE-014: Exponential Backoff Retry Queue + DLQ', () => {
  let app: Express;
  let testUserId: string;
  let managerId: string;
  let conversationId: string;
  let messageId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Create test users
    const userResult = await createTestUser(app, {
      email: 'user@yacc.local',
      password: 'test123',
      role: 'user',
    });
    testUserId = userResult.id;

    const managerResult = await createTestUser(app, {
      email: 'manager@yacc.local',
      password: 'test123',
      role: 'manager',
    });
    managerId = managerResult.id;

    // Create conversation
    const conversations = await seedTestConversations(testUserId, 1);
    conversationId = conversations[0].id;
  });

  afterAll(async () => {
    // Clean up
    await dbClient.delete(deadLetterQueue).where(eq(deadLetterQueue.conversationId, conversationId));
    await dbClient.delete(messages).where(eq(messages.conversationId, conversationId));
  });

  describe('DLQ Service - Move to DLQ', () => {
    it('should move failed message to DLQ', async () => {
      // Create a real message first (DLQ UUID contract requires messages.id)
      const newMessage = await dbClient
        .insert(messages)
        .values({
          conversationId,
          senderId: testUserId,
          senderName: 'Test User',
          body: 'Test message',
          status: 'failed',
          direction: 'outbound',
        })
        .returning();

      const messageId = newMessage[0].id;

      const testPayload = {
        messageId,
        conversationId,
        recipientId: testUserId,
        body: 'Test message',
        direction: 'outbound' as const,
        platformType: 'telegram' as const,
        retryCount: 3,
      };

      const entry = await dlqService.moveToDLQ(
        messageId,
        conversationId,
        testPayload,
        'max_retries_exceeded',
        'Connector timeout after 3 attempts'
      );

      expect(entry).toBeDefined();
      expect(entry.messageId).toBe(messageId);
      expect(entry.conversationId).toBe(conversationId);
      expect(entry.failureReason).toBe('max_retries_exceeded');
      expect(entry.totalAttempts).toBe(3);
      expect(entry.expiresAt).toBeDefined();
    });

    it('should set correct expiration date (7 days)', async () => {
      // Create a real message first (DLQ UUID contract requires messages.id)
      const newMessage = await dbClient
        .insert(messages)
        .values({
          conversationId,
          senderId: testUserId,
          senderName: 'Test User',
          body: 'Test message',
          status: 'failed',
          direction: 'outbound',
        })
        .returning();

      const messageId = newMessage[0].id;

      const testPayload = {
        messageId,
        conversationId,
        recipientId: testUserId,
        body: 'Test message',
        direction: 'outbound' as const,
        platformType: 'telegram' as const,
        retryCount: 3,
      };

      const entry = await dlqService.moveToDLQ(
        messageId,
        conversationId,
        testPayload,
        'platform_error',
        'Telegram API error'
      );

      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Should be approximately 7 days from now (within 1 minute tolerance)
      const diff = Math.abs(entry.expiresAt.getTime() - sevenDaysFromNow.getTime());
      expect(diff).toBeLessThan(60000); // 1 minute tolerance
    });
  });

  describe('DLQ Service - Query Operations', () => {
    beforeAll(async () => {
      // Create a message for testing
      const newMessage = await dbClient
        .insert(messages)
        .values({
          conversationId,
          senderId: testUserId,
          senderName: 'Test User',
          body: 'Test retry message',
          status: 'failed',
          direction: 'outbound',
        })
        .returning();

      messageId = newMessage[0].id;

      // Move to DLQ
      const payload = {
        messageId,
        conversationId,
        recipientId: testUserId,
        body: 'Test retry message',
        direction: 'outbound' as const,
        platformType: 'telegram' as const,
        retryCount: 3,
      };

      await dlqService.moveToDLQ(
        messageId,
        conversationId,
        payload,
        'network_error',
        'Connection refused'
      );
    });

    it('should retrieve DLQ entries with pagination', async () => {
      const { entries, total, page, limit } = await dlqService.getDLQEntries({
        page: 1,
        limit: 10,
      });

      expect(total).toBeGreaterThan(0);
      expect(entries).toBeInstanceOf(Array);
      expect(entries.length).toBeGreaterThan(0);
      expect(page).toBe(1);
      expect(limit).toBe(10);
    });

    it('should get DLQ statistics', async () => {
      const stats = await dlqService.getDLQStatistics();

      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.byFailureReason).toBeDefined();
      expect(Object.keys(stats.byFailureReason).length).toBeGreaterThan(0);
    });

    it('should get single DLQ entry by ID', async () => {
      // Get the first entry
      const { entries } = await dlqService.getDLQEntries({ limit: 1 });
      const entryId = entries[0].id;

      const entry = await dlqService.getDLQEntry(entryId);

      expect(entry).toBeDefined();
      expect(entry?.id).toBe(entryId);
      expect(entry?.messageId).toBeDefined();
    });

    it('should get DLQ entries by conversation', async () => {
      const entries = await dlqService.getDLQEntriesByConversation(conversationId);

      expect(entries).toBeInstanceOf(Array);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].conversationId).toBe(conversationId);
    });
  });

  describe('DLQ Service - Mark as Retried', () => {
    it('should mark DLQ entry as retried', async () => {
      // Create and move to DLQ
      const newMessage = await dbClient
        .insert(messages)
        .values({
          conversationId,
          senderId: testUserId,
          senderName: 'Test User',
          body: 'Message to retry',
          status: 'failed',
          direction: 'outbound',
        })
        .returning();

      const payload = {
        messageId: newMessage[0].id,
        conversationId,
        recipientId: testUserId,
        body: 'Message to retry',
        direction: 'outbound' as const,
        platformType: 'telegram' as const,
        retryCount: 3,
      };

      const dlqEntry = await dlqService.moveToDLQ(
        newMessage[0].id,
        conversationId,
        payload,
        'max_retries_exceeded',
        'Failed after 3 attempts'
      );

       // Mark as retried
       const updated = await dlqService.markAsRetried(dlqEntry.id, managerId);

       expect(updated.retryAttempt).toBe(true);
       expect(updated.retriedAt).toBeDefined();
       // UUID comparison: normalize format for comparison (database may return with or without hyphens)
       expect(updated.retriedBy?.replace(/-/g, '')).toBe(managerId.replace(/-/g, ''));
    });
  });

  describe('DLQ Service - Remove Entry', () => {
    it('should remove DLQ entry', async () => {
      // Create and move to DLQ
      const newMessage = await dbClient
        .insert(messages)
        .values({
          conversationId,
          senderId: testUserId,
          senderName: 'Test User',
          body: 'Message to delete',
          status: 'failed',
          direction: 'outbound',
        })
        .returning();

      const payload = {
        messageId: newMessage[0].id,
        conversationId,
        recipientId: testUserId,
        body: 'Message to delete',
        direction: 'outbound' as const,
        platformType: 'telegram' as const,
        retryCount: 3,
      };

      const dlqEntry = await dlqService.moveToDLQ(
        newMessage[0].id,
        conversationId,
        payload,
        'validation_error',
        'Invalid message format'
      );

      // Remove
      const result = await dlqService.removeDLQEntry(dlqEntry.id);

      expect(result).toBe(true);

      // Verify it's gone
      const deletedEntry = await dlqService.getDLQEntry(dlqEntry.id);
      expect(deletedEntry).toBeNull();
    });
  });

  describe('Message Status Tracking with DLQ', () => {
    it('should handle message send failure', async () => {
      // Create a message
      const newMessage = await dbClient
        .insert(messages)
        .values({
          conversationId,
          senderId: testUserId,
          senderName: 'Test User',
          body: 'Failure test message',
          status: 'pending',
          direction: 'outbound',
        })
        .returning();

      const msg = newMessage[0];

      expect(msg.status).toBe('pending');
      expect(msg.conversationId).toBe(conversationId);
    });
  });

  describe('DLQ Pagination and Filtering', () => {
    it('should paginate DLQ entries correctly', async () => {
      // Get first page
      const page1 = await dlqService.getDLQEntries({ page: 1, limit: 2 });
      const page2 = await dlqService.getDLQEntries({ page: 2, limit: 2 });

      expect(page1.page).toBe(1);
      expect(page2.page).toBe(2);

      // If there are more than 2 entries, pages should be different
      if (page1.total > 2) {
        expect(page1.entries[0].id).not.toBe(page2.entries[0]?.id);
      }
    });

    it('should filter by failure reason', async () => {
      // First, create an entry with network_error
      const newMessage = await dbClient
        .insert(messages)
        .values({
          conversationId,
          senderId: testUserId,
          senderName: 'Test User',
          body: 'Network error test',
          status: 'failed',
          direction: 'outbound',
        })
        .returning();

      const payload = {
        messageId: newMessage[0].id,
        conversationId,
        recipientId: testUserId,
        body: 'Network error test',
        direction: 'outbound' as const,
        platformType: 'telegram' as const,
        retryCount: 3,
      };

      await dlqService.moveToDLQ(
        newMessage[0].id,
        conversationId,
        payload,
        'network_error',
        'Connection timeout'
      );

      // Filter by reason
      const { entries } = await dlqService.getDLQEntries({
        failureReason: 'network_error',
      });

      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((e) => e.failureReason === 'network_error')).toBe(true);
    });
  });

  describe('DLQ Payload Preservation', () => {
    it('should preserve full message payload in DLQ', async () => {
      // Create a real message first (DLQ UUID contract requires messages.id)
      const newMessage = await dbClient
        .insert(messages)
        .values({
          conversationId,
          senderId: testUserId,
          senderName: 'Test User',
          body: 'Test message with metadata',
          status: 'failed',
          direction: 'outbound',
        })
        .returning();

      const messageId = newMessage[0].id;

      const testPayload = {
        messageId,
        conversationId,
        recipientId: testUserId,
        body: 'Test message with metadata',
        direction: 'outbound' as const,
        platformType: 'telegram' as const,
        retryCount: 2,
        metadata: {
          attachmentIds: ['att1', 'att2'],
          externalId: 'ext-123',
        },
      };

      const entry = await dlqService.moveToDLQ(
        messageId,
        conversationId,
        testPayload,
        'platform_error',
        'Telegram API error'
      );

      expect(entry.payload).toBeDefined();
      const payload = entry.payload as typeof testPayload;
      expect(payload.messageId).toBe(messageId);
      expect(payload.body).toBe(testPayload.body);
    });
  });

  describe('Concurrent DLQ Operations', () => {
    it('should handle concurrent DLQ operations', async () => {
      // Create 5 real messages first (DLQ UUID contract requires messages.id)
      const newMessages = await dbClient
        .insert(messages)
        .values(
          Array.from({ length: 5 }, (_, i) => ({
            conversationId,
            senderId: testUserId,
            senderName: 'Test User',
            body: `Concurrent message ${i}`,
            status: 'failed' as const,
            direction: 'outbound' as const,
          }))
        )
        .returning();

      const promises: Array<Promise<unknown>> = [];

      for (let i = 0; i < 5; i++) {
        const messageId = newMessages[i].id;
        const payload = {
          messageId,
          conversationId,
          recipientId: testUserId,
          body: `Concurrent message ${i}`,
          direction: 'outbound' as const,
          platformType: 'telegram' as const,
          retryCount: 3,
        };

        promises.push(
          dlqService.moveToDLQ(
            messageId,
            conversationId,
            payload,
            'network_error',
            `Error ${i}`
          )
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every((r) => (r as { id: string }).id)).toBe(true);
    });
  });
});
