import type { Job } from 'bullmq';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SendMessageJobPayload } from '../../types/message-queue.types';
const mocks = vi.hoisted(() => {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn(() => ({ where: whereMock }));
  const updateMock = vi.fn(() => ({ set: setMock }));
  const findMessageMock = vi.fn();
  const findConversationMock = vi.fn();

  const sendMessageMock = vi.fn();
  const getConnectorMock = vi.fn();

  const trackSentMessageMock = vi.fn().mockResolvedValue(undefined);
  const trackFailedMessageMock = vi.fn().mockResolvedValue(undefined);

  return {
    whereMock,
    setMock,
    updateMock,
    findMessageMock,
    findConversationMock,
    sendMessageMock,
    getConnectorMock,
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
    update: mocks.updateMock,
  },
}));

vi.mock('../../services/connector-manager.js', () => ({
  connectorManager: {
    getConnector: mocks.getConnectorMock,
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

import { processRetryJob } from '../messageRetryWorker';

describe('messageRetryWorker.processRetryJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends message via connector and marks sent with DB update', async () => {
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
      metadata: { correlationId: 'corr-123' },
    });
    mocks.findConversationMock.mockResolvedValue({
      id: payload.conversationId,
      externalThreadId: '#support',
    });

    mocks.getConnectorMock.mockReturnValue({ sendMessage: mocks.sendMessageMock });
    mocks.sendMessageMock.mockResolvedValue({
      success: true,
      platformMessageId: 'irc-msg-123',
      sentAt: '2026-02-16T00:00:00.000Z',
    });

    const job = {
      data: payload,
      attemptsMade: 0,
    } as unknown as Job<SendMessageJobPayload>;

    await processRetryJob(job);

    // Verify connector was called with correct parameters including correlationId
    expect(mocks.getConnectorMock).toHaveBeenCalledWith('irc');
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        recipientId: '#support',
        body: payload.body,
        platformType: 'irc',
        correlationId: 'corr-123',
      })
    );

    // Verify DB was updated with externalMessageId and status sent
    expect(mocks.updateMock).toHaveBeenCalled();
    expect(mocks.setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalMessageId: 'irc-msg-123',
        status: 'sent',
        metadata: {
          sentAt: '2026-02-16T00:00:00.000Z',
          platform: 'irc',
        },
      })
    );
    expect(mocks.whereMock).toHaveBeenCalled();

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

  it('marks failed and rethrows on connector failure with correlationId', async () => {
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
      metadata: { correlationId: 'corr-fail-456' },
    });
    mocks.findConversationMock.mockResolvedValue({
      id: payload.conversationId,
      externalThreadId: '#support',
    });

    mocks.getConnectorMock.mockReturnValue({ sendMessage: mocks.sendMessageMock });
    mocks.sendMessageMock.mockResolvedValue({
      success: false,
      error: 'Cannot send to channel',
      sentAt: '2026-02-16T00:00:00.000Z',
    });

    const job = {
      data: payload,
      attemptsMade: 1,
    } as unknown as Job<SendMessageJobPayload>;

    await expect(processRetryJob(job)).rejects.toThrow('Cannot send to channel');

    // Verify connector was called with correlationId
    expect(mocks.getConnectorMock).toHaveBeenCalledWith('irc');
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        recipientId: '#support',
        body: payload.body,
        platformType: 'irc',
        correlationId: 'corr-fail-456',
      })
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
      metadata: { correlationId: 'corr-original-789' },
    });
    mocks.findConversationMock.mockResolvedValue({
      id: payload.conversationId,
      externalThreadId: '#general',
    });

    mocks.getConnectorMock.mockReturnValue({ sendMessage: mocks.sendMessageMock });
    mocks.sendMessageMock.mockResolvedValue({
      success: true,
      platformMessageId: 'irc-msg-gen-456',
      sentAt: '2026-02-16T12:00:00.000Z',
    });

    const job = {
      data: payload,
      attemptsMade: 2,
    } as unknown as Job<SendMessageJobPayload>;

    await processRetryJob(job);

    // Verify connector was called with the stored correlationId
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: 'corr-original-789',
      })
    );

    // Verify DB was updated
    expect(mocks.setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        externalMessageId: 'irc-msg-gen-456',
        status: 'sent',
      })
    );

    // Verify MessageStatusTracker emitted success
    expect(mocks.trackSentMessageMock).toHaveBeenCalled();
  });
});
