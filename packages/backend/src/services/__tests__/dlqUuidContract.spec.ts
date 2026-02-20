/**
 * DLQ UUID Contract Tests
 *
 * Verifies that the Dead Letter Queue enforces the UUID contract:
 * - messageId must always be a UUID FK to messages.id
 * - External/job IDs are stored in metadata, not as messageId
 * - Traceability fields enable ops to investigate failures
 *
 * Issue: #270 - Enforce DLQ message_id UUID contract (or adjust schema) for retry/DLQ pipeline
 */

import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockedFunction } from 'vitest';
import { dbClient } from '../../infrastructure/db.client';
import type { SendMessageJobPayload } from '../../types/message-queue.types';
import { dlqService } from '../dlq.service';

// Mock database client
vi.mock('../../infrastructure/db.client', () => ({
  dbClient: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      deadLetterQueue: {
        findFirst: vi.fn(),
      },
    },
  },
}));

// Type definitions for mocked dbClient methods
interface MockInsertBuilder {
  values: MockedFunction<(data: Record<string, unknown>) => MockInsertBuilder>;
  returning: MockedFunction<(data?: Record<string, unknown>) => Promise<Record<string, unknown>[]>>;
}

interface MockSelectBuilder {
  from: MockedFunction<(table: string) => MockSelectBuilder>;
  where: MockedFunction<(condition: unknown) => MockSelectBuilder>;
  orderBy: MockedFunction<(order: unknown) => Promise<Record<string, unknown>[]>>;
}

vi.mock('../../infrastructure/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('DLQ Service - UUID Contract Enforcement', () => {
  const validUUID = uuidv4();
  const validConversationId = uuidv4();

  const mockPayload: SendMessageJobPayload = {
    messageId: validUUID,
    conversationId: validConversationId,
    recipientId: 'telegram:12345',
    body: 'Test message',
    direction: 'outbound',
    platformType: 'telegram',
    retryCount: 3,
    correlationId: 'trace-123',
    metadata: {
      jobId: 'msg-payload-abc123',
      externalMessageId: 'ext-msg-xyz',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('moveToDLQ with valid UUID messageId', () => {
    it('should accept valid UUID messageId', async () => {
      // Setup mock to return a successful insert
      const mockInsert: MockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: uuidv4(),
            messageId: validUUID,
            conversationId: validConversationId,
            payload: mockPayload,
            failureReason: 'max_retries_exceeded',
            totalAttempts: 3,
            lastError: 'Test error',
            expiresAt: new Date(),
            movedAt: new Date(),
            correlationId: 'trace-123',
            ircProfileId: null,
            externalThreadType: 'telegram_group',
            externalThreadId: 'tg-123',
            metadata: { jobId: 'msg-payload-abc123' },
          },
        ]),
      };

      (dbClient.insert as unknown as MockedFunction<typeof dbClient.insert>).mockReturnValue(mockInsert as unknown as ReturnType<typeof dbClient.insert>);

      const result = await dlqService.moveToDLQ(
        validUUID,
        validConversationId,
        mockPayload,
        'max_retries_exceeded',
        'Test error',
        {
          correlationId: 'trace-123',
          externalThreadType: 'telegram_group',
          externalThreadId: 'tg-123',
        }
      );

      expect(result).toBeDefined();
      expect(result.messageId).toBe(validUUID);
      expect(mockInsert.values).toHaveBeenCalled();
      const insertedValues = mockInsert.values.mock.calls[0][0];
      expect(insertedValues.messageId).toBe(validUUID);
      expect(insertedValues.correlationId).toBe('trace-123');
    });

    it('should reject invalid (non-UUID) messageId', async () => {
      const invalidMessageId = 'msg-payload-abc123'; // Job ID, not UUID

      await expect(
        dlqService.moveToDLQ(
          invalidMessageId,
          validConversationId,
          { ...mockPayload, messageId: invalidMessageId },
          'max_retries_exceeded',
          'Test error'
        )
      ).rejects.toThrow(/Invalid messageId/);
    });

    it('should store external job IDs in metadata, not as messageId', async () => {
      const mockInsert: MockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: uuidv4(),
            messageId: validUUID,
            conversationId: validConversationId,
            payload: mockPayload,
            failureReason: 'max_retries_exceeded',
            totalAttempts: 3,
            lastError: 'Test error',
            expiresAt: new Date(),
            movedAt: new Date(),
            metadata: {
              jobId: 'msg-payload-abc123',
              externalMessageId: 'ext-msg-xyz',
            },
          },
        ]),
      };

      (dbClient.insert as unknown as MockedFunction<typeof dbClient.insert>).mockReturnValue(mockInsert as unknown as ReturnType<typeof dbClient.insert>);

      await dlqService.moveToDLQ(
        validUUID,
        validConversationId,
        mockPayload,
        'max_retries_exceeded',
        'Test error',
        {
          jobId: 'msg-payload-abc123',
        }
      );

      const insertedValues = mockInsert.values.mock.calls[0][0] as Record<string, unknown>;
      expect(insertedValues.messageId).toBe(validUUID); // Always UUID
      expect(insertedValues.metadata).toBeDefined();
      const metadata = insertedValues.metadata as Record<string, string>;
      expect(metadata.jobId).toBe('msg-payload-abc123'); // Stored in metadata
    });

    it('should include traceability fields (correlationId, ircProfileId, externalThreadId)', async () => {
      const ircProfileId = uuidv4();

      const mockInsert: MockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: uuidv4(),
            messageId: validUUID,
            conversationId: validConversationId,
            payload: mockPayload,
            failureReason: 'max_retries_exceeded',
            totalAttempts: 3,
            lastError: 'Test error',
            expiresAt: new Date(),
            movedAt: new Date(),
            correlationId: 'trace-456',
            ircProfileId,
            externalThreadType: 'irc_channel',
            externalThreadId: '#general',
            metadata: { jobId: 'msg-abc' },
          },
        ]),
      };

      (dbClient.insert as unknown as MockedFunction<typeof dbClient.insert>).mockReturnValue(mockInsert as unknown as ReturnType<typeof dbClient.insert>);

      await dlqService.moveToDLQ(
        validUUID,
        validConversationId,
        mockPayload,
        'max_retries_exceeded',
        'Test error',
        {
          correlationId: 'trace-456',
          ircProfileId,
          externalThreadType: 'irc_channel',
          externalThreadId: '#general',
          jobId: 'msg-abc',
        }
      );

      const insertedValues = mockInsert.values.mock.calls[0][0] as Record<string, unknown>;
      expect(insertedValues.correlationId).toBe('trace-456');
      expect(insertedValues.ircProfileId).toBe(ircProfileId);
      expect(insertedValues.externalThreadType).toBe('irc_channel');
      expect(insertedValues.externalThreadId).toBe('#general');
    });

    it('should handle optional traceability fields gracefully', async () => {
      const mockInsert: MockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: uuidv4(),
            messageId: validUUID,
            conversationId: validConversationId,
            payload: mockPayload,
            failureReason: 'max_retries_exceeded',
            totalAttempts: 3,
            lastError: 'Test error',
            expiresAt: new Date(),
            movedAt: new Date(),
            correlationId: null,
            ircProfileId: null,
            externalThreadType: null,
            externalThreadId: null,
            metadata: null,
          },
        ]),
      };

      (dbClient.insert as unknown as MockedFunction<typeof dbClient.insert>).mockReturnValue(mockInsert as unknown as ReturnType<typeof dbClient.insert>);

      // Call without traceContext
      await dlqService.moveToDLQ(
        validUUID,
        validConversationId,
        mockPayload,
        'max_retries_exceeded',
        'Test error'
        // No traceContext parameter
      );

      const insertedValues = mockInsert.values.mock.calls[0][0] as Record<string, unknown>;
      expect(insertedValues.correlationId).toBeUndefined();
      expect(insertedValues.ircProfileId).toBeUndefined();
      expect(insertedValues.externalThreadType).toBeUndefined();
      expect(insertedValues.externalThreadId).toBeUndefined();
    });
  });

  describe('Database constraints validation', () => {
    it('should enforce 7-day expiration', async () => {
      const mockInsert: MockInsertBuilder = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: uuidv4(),
            messageId: validUUID,
            conversationId: validConversationId,
            payload: mockPayload,
            failureReason: 'max_retries_exceeded',
            totalAttempts: 3,
            lastError: 'Test error',
            expiresAt: new Date(),
            movedAt: new Date(),
          },
        ]),
      };

      (dbClient.insert as unknown as MockedFunction<typeof dbClient.insert>).mockReturnValue(mockInsert as unknown as ReturnType<typeof dbClient.insert>);

      await dlqService.moveToDLQ(
        validUUID,
        validConversationId,
        mockPayload,
        'max_retries_exceeded',
        'Test error'
      );

      const insertedValues = mockInsert.values.mock.calls[0][0] as Record<string, unknown>;
      const expiresAt = insertedValues.expiresAt as Date;
      const movedAt = new Date();

      // Should be approximately 7 days in the future
      const diffMs = expiresAt.getTime() - movedAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThan(6.99);
      expect(diffDays).toBeLessThan(7.01);
    });

    it('should be referenceable by conversation', async () => {
      const mockSelect: MockSelectBuilder = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          {
            id: uuidv4(),
            messageId: validUUID,
            conversationId: validConversationId,
            payload: mockPayload,
            failureReason: 'max_retries_exceeded',
          },
        ]),
      };

      (dbClient.select as unknown as MockedFunction<typeof dbClient.select>).mockReturnValue(mockSelect as unknown as ReturnType<typeof dbClient.select>);

      const result = await dlqService.getDLQEntriesByConversation(validConversationId);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].conversationId).toBe(validConversationId);
    });
  });
});
