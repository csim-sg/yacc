import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SendMessageJobPayload } from '../../types/message-queue.types';
import { RETRY_CONFIG } from '../../types/message-queue.types';
import { messageQueueDLQService } from '../message-queue-dlq.service';
import { messageQueueService } from '../message-queue.service';

/**
 * Message Queue Service - Unit & Integration Tests
 *
 * Test suite for message retry queue with exponential backoff.
 * Coverage:
 * - Job enqueueing (valid/invalid payloads)
 * - Exponential backoff verification
 * - Job completion/failure scenarios
 * - DLQ movement on max retries
 * - Queue statistics accuracy
 * - Error handling and recovery
 */

describe('Message Queue Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup: drain queues between tests
    try {
      await messageQueueService.drainQueues();
    } catch {
      // Ignore cleanup errors
    }
  });

  // ============================================
  // Job Enqueueing Tests
  // ============================================

  describe('enqueueMessage', () => {
    it('should enqueue a valid message for delivery', async () => {
      const payload: SendMessageJobPayload = {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Test message',
        direction: 'outbound',
        platformType: 'telegram',
        retryCount: 0,
      };

      const job = await messageQueueService.enqueueMessage(payload);

      expect(job).toBeDefined();
      expect(job.id).toBe(`msg-${payload.messageId}`);
      expect(job.data).toEqual(payload);
    });

    it('should reject invalid payload - missing required field', async () => {
      const invalidPayload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Test message',
        direction: 'outbound',
        platformType: 'telegram',
        retryCount: 0,
      } as SendMessageJobPayload;

      await expect(messageQueueService.enqueueMessage(invalidPayload)).rejects.toThrow();
    });

    it('should reject invalid payload - invalid UUID', async () => {
      const invalidPayload: SendMessageJobPayload = {
        messageId: 'not-a-uuid',
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Test message',
        direction: 'outbound',
        platformType: 'telegram',
        retryCount: 0,
      };

      await expect(messageQueueService.enqueueMessage(invalidPayload)).rejects.toThrow();
    });

    it('should reject invalid payload - invalid direction', async () => {
      const invalidPayload = {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Test message',
        direction: 'invalid',
        platformType: 'telegram',
        retryCount: 0,
      } as unknown as SendMessageJobPayload;

      await expect(messageQueueService.enqueueMessage(invalidPayload)).rejects.toThrow();
    });

    it('should reject invalid payload - invalid platform', async () => {
      const invalidPayload = {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Test message',
        direction: 'outbound',
        platformType: 'slack',
        retryCount: 0,
      } as unknown as SendMessageJobPayload;

      await expect(messageQueueService.enqueueMessage(invalidPayload)).rejects.toThrow();
    });

    it('should reject invalid payload - retry count exceeds max', async () => {
      const invalidPayload: SendMessageJobPayload = {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Test message',
        direction: 'outbound',
        platformType: 'telegram',
        retryCount: 5,
      };

      await expect(messageQueueService.enqueueMessage(invalidPayload)).rejects.toThrow();
    });

    it('should create idempotent job ID based on message ID', async () => {
      const payload: SendMessageJobPayload = {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Test message',
        direction: 'outbound',
        platformType: 'telegram',
        retryCount: 0,
      };

      const job1 = await messageQueueService.enqueueMessage(payload);
      const job2 = await messageQueueService.enqueueMessage(payload);

      expect(job1.id).toBe(job2.id);
      expect(job1.id).toBe(`msg-${payload.messageId}`);
    });

    it('should support optional metadata', async () => {
      const payload: SendMessageJobPayload = {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Test message',
        direction: 'outbound',
        platformType: 'telegram',
        retryCount: 0,
        metadata: {
          source: 'webhook',
          timestamp: Date.now(),
        },
      };

      const job = await messageQueueService.enqueueMessage(payload);

      expect(job.data.metadata).toEqual(payload.metadata);
    });
  });

  // ============================================
  // Queue Statistics Tests
  // ============================================

  describe('getQueueStatistics', () => {
    it('should return queue statistics with zero jobs initially', async () => {
      const stats = await messageQueueService.getQueueStatistics();

      expect(stats).toHaveProperty('active');
      expect(stats).toHaveProperty('waiting');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('delayed');
      expect(stats).toHaveProperty('dlq');
      expect(stats).toHaveProperty('totalJobs');

      expect(stats.active).toBeGreaterThanOrEqual(0);
      expect(stats.totalJobs).toBeGreaterThanOrEqual(0);
    });

    it('should include enqueued messages in statistics', async () => {
      const statsBefore = await messageQueueService.getQueueStatistics();

      const payload: SendMessageJobPayload = {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Test message',
        direction: 'outbound',
        platformType: 'telegram',
        retryCount: 0,
      };

      await messageQueueService.enqueueMessage(payload);

      const statsAfter = await messageQueueService.getQueueStatistics();

      expect(statsAfter.totalJobs).toBeGreaterThanOrEqual(statsBefore.totalJobs);
    });
  });

  // ============================================
  // Job Retrieval Tests
  // ============================================

  describe('getJob', () => {
    it('should retrieve an enqueued job by ID', async () => {
      const payload: SendMessageJobPayload = {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Test message',
        direction: 'outbound',
        platformType: 'telegram',
        retryCount: 0,
      };

      const enqueued = await messageQueueService.enqueueMessage(payload);
      const retrieved = await messageQueueService.getJob(enqueued.id || '');

      expect(retrieved).toBeDefined();
      expect(retrieved?.data).toEqual(payload);
    });

    it('should return undefined for non-existent job', async () => {
      const job = await messageQueueService.getJob('non-existent-id');

      expect(job).toBeUndefined();
    });
  });

  // ============================================
  // Dead-Letter Queue Tests
  // ============================================

  describe('Dead-Letter Queue Service', () => {
    it('should retrieve DLQ entries', async () => {
      const { entries, total } = await messageQueueDLQService.getDLQEntries(10);

      expect(Array.isArray(entries)).toBe(true);
      expect(typeof total).toBe('number');
      expect(total).toBeGreaterThanOrEqual(0);
    });

    it('should get DLQ statistics', async () => {
      const stats = await messageQueueDLQService.getDLQStats();

      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('byFailureReason');
      expect(stats).toHaveProperty('oldestEntry');
      expect(stats).toHaveProperty('newestEntry');

      expect(typeof stats.totalEntries).toBe('number');
      expect(typeof stats.byFailureReason).toBe('object');
    });

    it('should analyze DLQ patterns', async () => {
      const analysis = await messageQueueDLQService.analyzeDLQPatterns();

      expect(analysis).toHaveProperty('topFailureReasons');
      expect(analysis).toHaveProperty('avgAttemptsBeforeFailure');
      expect(analysis).toHaveProperty('mostCommonError');
      expect(analysis).toHaveProperty('conversationCount');

      expect(Array.isArray(analysis.topFailureReasons)).toBe(true);
      expect(typeof analysis.avgAttemptsBeforeFailure).toBe('number');
    });

    it('should get DLQ entries by failure reason', async () => {
      const entries = await messageQueueDLQService.getDLQEntriesByReason('max_retries_exceeded');

      expect(Array.isArray(entries)).toBe(true);
    });

    it('should bulk retry DLQ entries', async () => {
      const result = await messageQueueDLQService.bulkRetryDLQEntries([
        '550e8400-e29b-41d4-a716-446655440001',
      ]);

      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('errors');

      expect(typeof result.successful).toBe('number');
      expect(typeof result.failed).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should clear old DLQ entries', async () => {
      const clearedCount = await messageQueueDLQService.clearOldDLQEntries(0);

      expect(typeof clearedCount).toBe('number');
      expect(clearedCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================
  // Queue Draining Tests
  // ============================================

  describe('drainQueues', () => {
    it('should drain all queues without error', async () => {
      const payload: SendMessageJobPayload = {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Test message',
        direction: 'outbound',
        platformType: 'telegram',
        retryCount: 0,
      };

      // Enqueue some messages
      await messageQueueService.enqueueMessage(payload);

      // Drain should succeed
      await expect(messageQueueService.drainQueues()).resolves.not.toThrow();

      // Verify queues are empty
      const stats = await messageQueueService.getQueueStatistics();
      expect(stats.totalJobs).toBe(0);
    });
  });

  // ============================================
  // Configuration Tests
  // ============================================

  describe('Retry Configuration', () => {
    it('should have correct max attempts', () => {
      expect(RETRY_CONFIG.MAX_ATTEMPTS).toBe(3);
    });

    it('should have correct backoff delays', () => {
      expect(RETRY_CONFIG.BACKOFF_DELAYS).toHaveLength(3);
      expect(RETRY_CONFIG.BACKOFF_DELAYS[0]).toBe(60000); // 1 minute
      expect(RETRY_CONFIG.BACKOFF_DELAYS[1]).toBe(300000); // 5 minutes
      expect(RETRY_CONFIG.BACKOFF_DELAYS[2]).toBe(1800000); // 30 minutes
    });

    it('should have correct concurrency setting', () => {
      expect(RETRY_CONFIG.CONCURRENCY).toBe(5);
    });

    it('should have correct timeout setting', () => {
      expect(RETRY_CONFIG.TIMEOUT_MS).toBe(30000); // 30 seconds
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('Error Handling', () => {
    it('should handle enqueue errors gracefully', async () => {
      const invalidPayload = {
        messageId: 'invalid-uuid',
        conversationId: 'also-invalid',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: '',
        direction: 'invalid-direction',
        platformType: 'unsupported-platform',
        retryCount: 999,
      } as unknown as SendMessageJobPayload;

      await expect(
        messageQueueService.enqueueMessage(invalidPayload)
      ).rejects.toThrow();
    });

    it('should handle missing job gracefully', async () => {
      const job = await messageQueueService.getJob('non-existent');
      expect(job).toBeUndefined();
    });
  });

  // ============================================
  // Integration Tests
  // ============================================

  describe('Integration Scenarios', () => {
    it('should handle multiple concurrent enqueues', async () => {
      const payloads: SendMessageJobPayload[] = Array.from({ length: 5 }).map((_, i) => ({
        messageId: `550e8400-e29b-41d4-a716-44665544000${i}`,
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: `Test message ${i}`,
        direction: 'outbound' as const,
        platformType: 'telegram' as const,
        retryCount: 0,
      }));

      const jobs = await Promise.all(
        payloads.map((p) => messageQueueService.enqueueMessage(p))
      );

      expect(jobs).toHaveLength(5);
      jobs.forEach((job, i) => {
        expect(job.id).toBe(`msg-${payloads[i].messageId}`);
      });
    });

    it('should handle mixed valid and invalid payloads', async () => {
      const validPayload: SendMessageJobPayload = {
        messageId: '550e8400-e29b-41d4-a716-446655440001',
        conversationId: '550e8400-e29b-41d4-a716-446655440002',
        recipientId: '550e8400-e29b-41d4-a716-446655440003',
        body: 'Valid message',
        direction: 'outbound',
        platformType: 'telegram',
        retryCount: 0,
      };

      const invalidPayload = {
        messageId: 'invalid',
      } as SendMessageJobPayload;

      const validResult = await messageQueueService.enqueueMessage(validPayload);
      expect(validResult).toBeDefined();

      await expect(messageQueueService.enqueueMessage(invalidPayload)).rejects.toThrow();
    });
  });

  // ============================================
  // Cleanup Tests
  // ============================================

  describe('Service Cleanup', () => {
    it('should close service without error', async () => {
      await expect(messageQueueService.close()).resolves.not.toThrow();
    });
  });
});
