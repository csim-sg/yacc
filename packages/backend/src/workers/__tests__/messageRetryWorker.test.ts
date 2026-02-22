import type { Job } from 'bullmq';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SendMessageJobPayload } from '../../types/message-queue.types';
import { processRetryJob } from '../messageRetryWorker';

const mocks = vi.hoisted(() => {
  const findMessageMock = vi.fn();
  const findConversationMock = vi.fn();
  const handleOutboundMock = vi.fn();
  const trackSentMessageMock = vi.fn().mockResolvedValue(undefined);
  const trackFailedMessageMock = vi.fn().mockResolvedValue(undefined);

  return {
    findMessageMock,
    findConversationMock,
    handleOutboundMock,
    trackSentMessageMock,
    trackFailedMessageMock,
  };
});

vi.mock('../../infrastructure/db.client.js', () => ({
  dbClient: {
    query: {
      messages: {
        findFirst: mocks.findMessageMock,
      },
      conversations: {
        findFirst: mocks.findConversationMock,
      },
    },
  },
}));

vi.mock('../../services/gateway-exchange.js', () => ({
  gatewayExchange: {
    handleOutbound: mocks.handleOutboundMock,
  },
}));

// Prevent ioredis connection from being created during unit tests
vi.mock('../../infrastructure/redis.client.js', () => ({
  redisClient: {},
  getRedisClient: () => ({}),
}));

vi.mock('../../services/websocket/websocket-gateway.js', () => ({
  isWebSocketGatewayAvailable: () => false,
  emitToConversation: vi.fn(),
}));

vi.mock('../../services/messageStatusTracker.js', () => ({
  MessageStatusTracker: {
    trackSentMessage: mocks.trackSentMessageMock,
    trackFailedMessage: mocks.trackFailedMessageMock,
  },
}));

describe('messageRetryWorker.processRetryJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends message via gateway-exchange and marks sent', async () => {
    const payload: SendMessageJobPayload = {
      messageId: '550e8400-e29b-41d4-a716-446655440001',
      conversationId: '550e8400-e29b-41d4-a716-446655440002',
      recipientId: '#support',
      body: 'Hello from retry',
      direction: 'outbound',
      platformType: 'irc',
      retryCount: 0,
      correlationId: 'corr-123',
      metadata: { requestedByUserId: 'user-1' },
    };

    mocks.findMessageMock.mockResolvedValue({
      id: payload.messageId,
      senderId: 'user-1',
      metadata: { correlationId: 'corr-123' },
    });
    mocks.findConversationMock.mockResolvedValue({
      id: payload.conversationId,
      externalThreadId: '#support',
    });

    mocks.handleOutboundMock.mockResolvedValue({
      success: true,
      externalMessageId: 'irc-msg-123',
      timestamp: '2026-02-16T00:00:00.000Z',
    });

    const job = {
      data: payload,
      attemptsMade: 0,
    } as unknown as Job<SendMessageJobPayload>;

    await processRetryJob(job);

    // Verify gateway-exchange was called with correct parameters
    expect(mocks.handleOutboundMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: payload.conversationId,
        body: payload.body,
        userId: 'user-1',
        correlationId: 'corr-123',
      }),
      payload.messageId
    );

    // Verify MessageStatusTracker was called to emit WebSocket event
    expect(mocks.trackSentMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        status: 'sent',
        platform: 'irc',
      })
    );
  });

  it('marks failed and rethrows on gateway-exchange failure with correlationId', async () => {
    const payload: SendMessageJobPayload = {
      messageId: '550e8400-e29b-41d4-a716-446655440011',
      conversationId: '550e8400-e29b-41d4-a716-446655440012',
      recipientId: '#support',
      body: 'Failed message',
      direction: 'outbound',
      platformType: 'irc',
      retryCount: 1,
      correlationId: 'corr-fail-456',
    };

    mocks.findMessageMock.mockResolvedValue({
      id: payload.messageId,
      senderId: 'user-1',
      metadata: { correlationId: 'corr-fail-456' },
    });
    mocks.findConversationMock.mockResolvedValue({
      id: payload.conversationId,
      externalThreadId: '#support',
    });

    mocks.handleOutboundMock.mockResolvedValue({
      success: false,
      error: { message: 'Cannot send to channel' },
    });

    const job = {
      data: payload,
      attemptsMade: 1,
    } as unknown as Job<SendMessageJobPayload>;

    await expect(processRetryJob(job)).rejects.toThrow('Cannot send to channel');

    // Verify gateway-exchange was called with correlationId
    expect(mocks.handleOutboundMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: payload.conversationId,
        body: payload.body,
        correlationId: 'corr-fail-456',
      }),
      payload.messageId
    );

    // Verify MessageStatusTracker.trackFailedMessage was called
    expect(mocks.trackFailedMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        status: 'failed',
        platform: 'irc',
        error: 'Cannot send to channel',
      })
    );
  });

  it('propagates correlationId from message metadata on retry', async () => {
    const payload: SendMessageJobPayload = {
      messageId: '550e8400-e29b-41d4-a716-446655440021',
      conversationId: '550e8400-e29b-41d4-a716-446655440022',
      recipientId: '#general',
      body: 'Retry with stored correlationId',
      direction: 'outbound',
      platformType: 'irc',
      retryCount: 2,
      // No correlationId in payload - should come from message.metadata
    };

    // Message has correlationId in metadata from original request
    mocks.findMessageMock.mockResolvedValue({
      id: payload.messageId,
      senderId: 'user-1',
      metadata: { correlationId: 'corr-original-789' },
    });
    mocks.findConversationMock.mockResolvedValue({
      id: payload.conversationId,
      externalThreadId: '#general',
    });

    mocks.handleOutboundMock.mockResolvedValue({
      success: true,
      externalMessageId: 'irc-msg-gen-456',
      timestamp: '2026-02-16T12:00:00.000Z',
    });

    const job = {
      data: payload,
      attemptsMade: 2,
    } as unknown as Job<SendMessageJobPayload>;

    await processRetryJob(job);

    // Verify gateway-exchange was called with the stored correlationId
    expect(mocks.handleOutboundMock).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'corr-original-789',
      }),
      payload.messageId
    );

    // Verify MessageStatusTracker emitted success
    expect(mocks.trackSentMessageMock).toHaveBeenCalled();
  });
});
