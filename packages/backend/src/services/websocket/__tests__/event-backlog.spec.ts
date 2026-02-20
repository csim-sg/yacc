/**
 * Event Backlog Service Tests
 *
 * Tests event storage, retrieval, filtering, and cleanup for reconnection backlog
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock logger and redis
vi.mock('../../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../../infrastructure/redis.client', () => ({
  redisClient: {
    get: vi.fn(),
    set: vi.fn(),
    expire: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  },
}));

import { redisClient } from '../../../infrastructure/redis.client';
import {
  storeEvent,
  getBacklogForUser,
  getBacklogForConversation,
  clearBacklogForUser,
  getBacklogStats,
} from '../event-backlog.service';

/**
 * Helper to create mock payload
 */
const createMessageSentPayload = () => ({
  messageId: '550e8400-e29b-41d4-a716-446655440000',
  conversationId: '550e8400-e29b-41d4-a716-446655440001',
  status: 'sent' as const,
  sentAt: new Date().toISOString(),
});

const createTypingStartedPayload = () => ({
  conversationId: '550e8400-e29b-41d4-a716-446655440000',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  name: 'John Doe',
});

const createPresenceUpdatePayload = () => ({
  userId: '550e8400-e29b-41d4-a716-446655440000',
  status: 'online' as const,
  lastSeen: new Date().toISOString(),
});

describe('Event Backlog Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Store Event Tests
  // ============================================

  describe('storeEvent', () => {
    it('should store message.sent event for user', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';
      const payload = createMessageSentPayload();

      vi.mocked(redisClient.get).mockResolvedValueOnce(null);
      vi.mocked(redisClient.set).mockResolvedValueOnce('OK');
      vi.mocked(redisClient.expire).mockResolvedValueOnce(1);

      await storeEvent('message.sent', payload, conversationId, userId);

      expect(redisClient.set).toHaveBeenCalled();
      expect(redisClient.expire).toHaveBeenCalled();
    });

    it('should store typing indicator event', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';
      const payload = createTypingStartedPayload();

      vi.mocked(redisClient.get).mockResolvedValueOnce(null);
      vi.mocked(redisClient.set).mockResolvedValueOnce('OK');
      vi.mocked(redisClient.expire).mockResolvedValueOnce(1);

      await storeEvent('typing.started', payload, conversationId, userId);

      expect(redisClient.set).toHaveBeenCalled();
    });

    it('should append to existing backlog', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';

      const existingBacklog = [
        {
          eventName: 'message.sent',
          payload: createMessageSentPayload(),
          conversationId,
          emittedAt: new Date(Date.now() - 1000).toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      ];

      vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify(existingBacklog));
      vi.mocked(redisClient.set).mockResolvedValueOnce('OK');
      vi.mocked(redisClient.expire).mockResolvedValueOnce(1);

      const newPayload = createTypingStartedPayload();
      await storeEvent('typing.started', newPayload, conversationId, userId);

      // Verify the backlog was updated
      const callArgs = vi.mocked(redisClient.set).mock.calls[0];
      const storedData = JSON.parse(callArgs[1] as string);
      expect(storedData).toHaveLength(2);
      expect(storedData[0].eventName).toBe('message.sent');
      expect(storedData[1].eventName).toBe('typing.started');
    });

    it('should handle store failures gracefully', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const payload = createMessageSentPayload();

      vi.mocked(redisClient.set).mockRejectedValueOnce(new Error('Redis error'));

      // Should not throw
      await expect(storeEvent('message.sent', payload, undefined, userId)).resolves.not.toThrow();
    });
  });

  // ============================================
  // Get Backlog Tests
  // ============================================

  describe('getBacklogForUser', () => {
    it('should retrieve user backlog', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      const backlog = [
        {
          eventName: 'message.sent',
          payload: createMessageSentPayload(),
          conversationId: '550e8400-e29b-41d4-a716-446655440001',
          emittedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        {
          eventName: 'typing.started',
          payload: createTypingStartedPayload(),
          conversationId: '550e8400-e29b-41d4-a716-446655440001',
          emittedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      ];

      vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify(backlog));

      const result = await getBacklogForUser(userId);

      expect(result).toHaveLength(2);
      expect(result[0].eventName).toBe('message.sent');
      expect(result[1].eventName).toBe('typing.started');
    });

    it('should return empty array if no backlog', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      vi.mocked(redisClient.get).mockResolvedValueOnce(null);

      const result = await getBacklogForUser(userId);

      expect(result).toEqual([]);
    });

    it('should filter out expired events', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      const backlog = [
        {
          eventName: 'message.sent',
          payload: createMessageSentPayload(),
          conversationId: '550e8400-e29b-41d4-a716-446655440001',
          emittedAt: new Date(Date.now() - 3600000).toISOString(),
          expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired
        },
        {
          eventName: 'typing.started',
          payload: createTypingStartedPayload(),
          conversationId: '550e8400-e29b-41d4-a716-446655440001',
          emittedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(), // Valid
        },
      ];

      vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify(backlog));

      const result = await getBacklogForUser(userId);

      expect(result).toHaveLength(1);
      expect(result[0].eventName).toBe('typing.started');
    });

    it('should handle retrieval failures gracefully', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      vi.mocked(redisClient.get).mockRejectedValueOnce(new Error('Redis error'));

      const result = await getBacklogForUser(userId);

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // Get Backlog for Conversation Tests
  // ============================================

  describe('getBacklogForConversation', () => {
    it('should filter backlog by conversation', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';

      const backlog = [
        {
          eventName: 'message.sent',
          payload: createMessageSentPayload(),
          conversationId,
          emittedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        {
          eventName: 'message.sent',
          payload: { ...createMessageSentPayload(), conversationId: 'other-conv' },
          conversationId: 'other-conv',
          emittedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
        {
          eventName: 'presence.updated',
          payload: createPresenceUpdatePayload(),
          conversationId: undefined, // Global event
          emittedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      ];

      vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify(backlog));

      const result = await getBacklogForConversation(userId, conversationId);

      expect(result).toHaveLength(2); // Only conversation-specific + global
      expect(result[0].eventName).toBe('message.sent');
      expect(result[0].conversationId).toBe(conversationId);
      expect(result[1].eventName).toBe('presence.updated');
    });

    it('should include global events in conversation backlog', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';

      const backlog = [
        {
          eventName: 'presence.updated',
          payload: createPresenceUpdatePayload(),
          conversationId: undefined,
          emittedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      ];

      vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify(backlog));

      const result = await getBacklogForConversation(userId, conversationId);

      expect(result).toHaveLength(1);
      expect(result[0].eventName).toBe('presence.updated');
    });
  });

  // ============================================
  // Clear Backlog Tests
  // ============================================

  describe('clearBacklogForUser', () => {
    it('should delete user backlog', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      vi.mocked(redisClient.del).mockResolvedValueOnce(1);

      await clearBacklogForUser(userId);

      expect(redisClient.del).toHaveBeenCalledWith(`ws:backlog:${userId}`);
    });

    it('should handle deletion failures gracefully', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';

      vi.mocked(redisClient.del).mockRejectedValueOnce(new Error('Redis error'));

      // Should not throw
      await expect(clearBacklogForUser(userId)).resolves.not.toThrow();
    });
  });

  // ============================================
  // Get Stats Tests
  // ============================================

  describe('getBacklogStats', () => {
    it('should calculate backlog statistics', async () => {
      const keys = [
        'ws:backlog:user1',
        'ws:backlog:user2',
        'ws:backlog:user3',
      ];

      const backlog1 = Array(10).fill({
        eventName: 'message.sent',
        payload: createMessageSentPayload(),
        conversationId: 'conv1',
        emittedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      const backlog2 = Array(5).fill({
        eventName: 'typing.started',
        payload: createTypingStartedPayload(),
        conversationId: 'conv1',
        emittedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      vi.mocked(redisClient.keys).mockResolvedValueOnce(keys);
      vi.mocked(redisClient.get)
        .mockResolvedValueOnce(JSON.stringify(backlog1))
        .mockResolvedValueOnce(JSON.stringify(backlog2))
        .mockResolvedValueOnce(JSON.stringify([]));

      const stats = await getBacklogStats();

      expect(stats.totalBacklogs).toBe(3);
      expect(stats.estimatedEventsStored).toBe(15);
      expect(stats.estimatedMemoryMb).toBeGreaterThan(0);
    });

    it('should handle stats calculation failures gracefully', async () => {
      vi.mocked(redisClient.keys).mockRejectedValueOnce(new Error('Redis error'));

      const stats = await getBacklogStats();

      expect(stats.totalBacklogs).toBe(0);
      expect(stats.estimatedEventsStored).toBe(0);
      expect(stats.estimatedMemoryMb).toBe(0);
    });
  });

  // ============================================
  // Integration Scenarios
  // ============================================

  describe('Integration Scenarios', () => {
    it('should handle full backlog lifecycle', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';

      // 1. Store events
      vi.mocked(redisClient.get).mockResolvedValueOnce(null);
      vi.mocked(redisClient.set).mockResolvedValueOnce('OK');
      vi.mocked(redisClient.expire).mockResolvedValueOnce(1);

      await storeEvent('message.sent', createMessageSentPayload(), conversationId, userId);

      // 2. Retrieve backlog
      const backlog = [
        {
          eventName: 'message.sent',
          payload: createMessageSentPayload(),
          conversationId,
          emittedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      ];

      vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify(backlog));

      const retrieved = await getBacklogForUser(userId);
      expect(retrieved).toHaveLength(1);

      // 3. Clear backlog
      vi.mocked(redisClient.del).mockResolvedValueOnce(1);

      await clearBacklogForUser(userId);

      expect(redisClient.del).toHaveBeenCalled();
    });

    it('should handle large backlogs without memory issues', async () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const conversationId = '550e8400-e29b-41d4-a716-446655440001';

      // Create large backlog
      const largeBacklog = Array(1100).fill({
        eventName: 'message.sent',
        payload: createMessageSentPayload(),
        conversationId,
        emittedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });

      vi.mocked(redisClient.get).mockResolvedValueOnce(JSON.stringify(largeBacklog));
      vi.mocked(redisClient.set).mockResolvedValueOnce('OK');
      vi.mocked(redisClient.expire).mockResolvedValueOnce(1);

      // Add one more event - should trim to 1000
      await storeEvent('typing.started', createTypingStartedPayload(), conversationId, userId);

      const callArgs = vi.mocked(redisClient.set).mock.calls[0];
      const storedData = JSON.parse(callArgs[1] as string);

      // Should keep last 1000 events
      expect(storedData.length).toBeLessThanOrEqual(1001);
    });
  });
});
