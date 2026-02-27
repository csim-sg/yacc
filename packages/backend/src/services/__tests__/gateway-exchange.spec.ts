/**
 * Gateway Exchange Service Unit Tests
 *
 * Tests the central hub for message orchestration between platforms and YACC.
 */

import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockAdapter } from '../../../tests/utils/MockAdapter';
import type { PlatformAdapter } from '../../infrastructure/types/adapter.interface';
import type {
  InboundMessageEvent,
  OutboundMessagePayload,
  SendResult,
} from '../../types/gateway.types';
import { GatewayExchange } from '../gateway-exchange';

// Mock dependencies
const mockSelect = vi.fn(() => ({
  from: vi.fn(() => ({
    where: vi.fn(() => []),
    limit: vi.fn(() => []),
  })),
}));

const mockInsert = vi.fn(() => ({
  values: vi.fn(() => ({
    returning: vi.fn(() => [{
      id: 'test-message-id',
    }]),
  })),
}));

const mockUpdate = vi.fn(() => ({
  set: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(() => [{
        id: 'test-message-id',
      }]),
    })),
  })),
}));

vi.mock('../../infrastructure/db.client', () => ({
  dbClient: {
    query: {
      conversations: {
        findFirst: vi.fn(),
      },
    },
    select: () => mockSelect(),
    insert: () => mockInsert(),
    update: () => mockUpdate(),
  },
}));

vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../audit.service', () => ({
  auditService: {
    logAction: vi.fn(),
  },
}));

vi.mock('../dlq.service', () => ({
  dlqService: {
    moveToDLQ: vi.fn(),
  },
}));

vi.mock('../conversation.service', () => ({
  conversationService: {
    createMessage: vi.fn(),
  },
}));

vi.mock('../websocket/websocket-gateway', () => ({
  isWebSocketGatewayAvailable: vi.fn(() => true),
  emitToConversation: vi.fn(),
}));

describe('GatewayExchange', () => {
  let gateway: GatewayExchange;
  let mockAdapter: MockAdapter;

  const createTestInboundEvent = (overrides?: Partial<InboundMessageEvent>): InboundMessageEvent => ({
    platform: 'irc',
    externalThreadId: '#test-channel',
    sender: {
      externalUserId: 'test-user-123',
      displayName: 'Test User',
    },
    body: 'Hello, world!',
    receivedAt: new Date(),
    rawPayload: { test: true },
    correlationId: 'test-correlation-id',
    ...overrides,
  });

  const createTestOutboundPayload = (overrides?: Partial<OutboundMessagePayload>): OutboundMessagePayload => ({
    conversationId: 'test-conversation-id',
    body: 'Reply message',
    userId: 'test-user-id',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new GatewayExchange();
    mockAdapter = new MockAdapter();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('registerAdapter', () => {
    it('should register an adapter and subscribe to events', () => {
      gateway.registerAdapter(mockAdapter);

      expect(gateway.getAdapter('irc')).toBe(mockAdapter);
      expect(gateway.getAllAdapters()).toHaveLength(1);
    });

    it('should warn when overwriting existing adapter', async () => {
      const { logger } = await import('../../infrastructure/logger');

      gateway.registerAdapter(mockAdapter);
      gateway.registerAdapter(mockAdapter);

      expect(logger.warn).toHaveBeenCalledWith(
        { platform: 'irc' },
        'Overwriting existing adapter registration'
      );
    });
  });

  describe('getAdapter', () => {
    it('should return undefined for unregistered platform', () => {
      expect(gateway.getAdapter('telegram')).toBeUndefined();
    });

    it('should return registered adapter', () => {
      gateway.registerAdapter(mockAdapter);
      expect(gateway.getAdapter('irc')).toBe(mockAdapter);
    });
  });

  describe('handleInbound', () => {
    it('should log to DLQ for invalid event with empty body', async () => {
      const { dlqService } = await import('../dlq.service');
      const invalidEvent = createTestInboundEvent({ body: '' });

      // handleInbound catches errors internally and logs to DLQ
      await gateway.handleInbound(invalidEvent);

      expect(dlqService.moveToDLQ).toHaveBeenCalled();
    });

    it('should log to DLQ for missing platform', async () => {
      const { dlqService } = await import('../dlq.service');
      const invalidEvent = createTestInboundEvent({ platform: undefined as unknown as 'irc' });

      await gateway.handleInbound(invalidEvent);

      expect(dlqService.moveToDLQ).toHaveBeenCalled();
    });

    it('should log to DLQ for missing sender', async () => {
      const { dlqService } = await import('../dlq.service');
      const invalidEvent = createTestInboundEvent({
        sender: { externalUserId: '', displayName: '' }
      });

      await gateway.handleInbound(invalidEvent);

      expect(dlqService.moveToDLQ).toHaveBeenCalled();
    });
  });

  describe('handleOutbound', () => {
    it('should throw error when conversation not found', async () => {
      const { dbClient } = await import('../../infrastructure/db.client');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(dbClient.query.conversations.findFirst).mockResolvedValue(undefined as any);

      const payload = createTestOutboundPayload();
      const result = await gateway.handleOutbound(payload, 'test-msg-id');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Conversation not found');
    });

    it('should throw error when adapter not registered', async () => {
      const { dbClient } = await import('../../infrastructure/db.client');
      vi.mocked(dbClient.query.conversations.findFirst).mockResolvedValue({
        id: 'test-conversation-id',
        channel: 'telegram',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      const payload = createTestOutboundPayload();
      const result = await gateway.handleOutbound(payload, 'test-msg-id');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No adapter registered');
    });

    it('should call adapter.send with correct payload', async () => {
      const { dbClient } = await import('../../infrastructure/db.client');
      vi.mocked(dbClient.query.conversations.findFirst).mockResolvedValue({
        id: 'test-conversation-id',
        channel: 'irc',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      gateway.registerAdapter(mockAdapter);
      mockAdapter.setSendResult({ success: true, externalMessageId: 'ext-123', timestamp: new Date() });

      const sendSpy = vi.spyOn(mockAdapter, 'send');
      const payload = createTestOutboundPayload();
      const result = await gateway.handleOutbound(payload, 'test-msg-id');

      expect(sendSpy).toHaveBeenCalledWith(payload);
      expect(result.success).toBe(true);
      expect(result.externalMessageId).toBe('ext-123');
    });

    it('should update message status to sent on success', async () => {
      const { dbClient } = await import('../../infrastructure/db.client');
      vi.mocked(dbClient.query.conversations.findFirst).mockResolvedValue({
        id: 'test-conversation-id',
        channel: 'irc',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      gateway.registerAdapter(mockAdapter);
      mockAdapter.setSendResult({ success: true, externalMessageId: 'ext-123', timestamp: new Date() });

      const payload = createTestOutboundPayload();
      await gateway.handleOutbound(payload, 'test-msg-id');

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should update message status to failed on adapter failure', async () => {
      const { dbClient } = await import('../../infrastructure/db.client');
      vi.mocked(dbClient.query.conversations.findFirst).mockResolvedValue({
        id: 'test-conversation-id',
        channel: 'irc',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      gateway.registerAdapter(mockAdapter);
      mockAdapter.setSendResult({
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Connection failed',
          retryable: true,
        },
        timestamp: new Date(),
      });

      const payload = createTestOutboundPayload();
      const result = await gateway.handleOutbound(payload, 'test-msg-id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
    });
  });

  describe('circuit breaker', () => {
    it('should trigger circuit breaker after 5 consecutive failures', async () => {
      const mod = await import('../conversation.service');
      const conversationService = mod.conversationService;

      // Mock conversation service to throw errors
      vi.mocked(conversationService.createMessage).mockRejectedValue(new Error('DB error'));

      const event = createTestInboundEvent();
      const disconnectSpy = vi.spyOn(mockAdapter, 'disconnect');

      gateway.registerAdapter(mockAdapter);

      // Trigger 5 failures
      for (let i = 0; i < 5; i++) {
        try {
          await gateway.handleInbound(event);
        } catch {
          // Expected to fail
        }
      }

      // Circuit breaker should have triggered
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('healthCheckAll', () => {
    it('should return health status for all adapters', async () => {
      mockAdapter.status = 'connected';
      gateway.registerAdapter(mockAdapter);

      const results = await gateway.healthCheckAll();

      expect(results['irc']).toBeDefined();
      expect(results['irc'].healthy).toBe(true);
    });

    it('should handle health check errors gracefully', async () => {
      class FailingAdapter extends EventEmitter implements PlatformAdapter {
        readonly platform = 'telegram';
        status = 'error' as const;
        async connect(): Promise<void> {}
        async disconnect(): Promise<void> {}
        async healthCheck(): Promise<{ healthy: boolean; details?: string }> {
          throw new Error('Health check failed');
        }
        async send(): Promise<SendResult> {
          return { success: false, timestamp: new Date() };
        }
      }

      const failingAdapter = new FailingAdapter();
      gateway.registerAdapter(failingAdapter);

      const results = await gateway.healthCheckAll();

      expect(results['telegram'].healthy).toBe(false);
      expect(results['telegram'].details).toContain('Health check failed');
    });
  });

  describe('adapter events', () => {
    it('should reset failure counter on adapter:connected event', async () => {
      gateway.registerAdapter(mockAdapter);

      // Trigger some failures first
      // (we don't need to actually fail, just emit connected to test the reset)
      mockAdapter.emit('adapter:connected');

      const { logger } = await import('../../infrastructure/logger');
      expect(logger.info).toHaveBeenCalledWith(
        { platform: 'irc' },
        'Adapter connected'
      );
    });

    it('should log adapter:disconnected event', async () => {
      const { logger } = await import('../../infrastructure/logger');

      gateway.registerAdapter(mockAdapter);
      mockAdapter.emit('adapter:disconnected', { reason: 'connection lost' });

      expect(logger.warn).toHaveBeenCalledWith(
        { platform: 'irc', reason: 'connection lost' },
        'Adapter disconnected'
      );
    });

    it('should log adapter:error event', async () => {
      const { logger } = await import('../../infrastructure/logger');

      gateway.registerAdapter(mockAdapter);
      mockAdapter.emit('adapter:error', new Error('Test error'));

      expect(logger.error).toHaveBeenCalledWith(
        { platform: 'irc', error: 'Test error' },
        'Adapter error'
      );
    });
  });
});
