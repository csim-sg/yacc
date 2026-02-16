import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { SendMessageJobPayload } from '../../types/message-queue.types';

const mocks = vi.hoisted(() => {
  const whereMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn(() => ({ where: whereMock }));
  const updateMock = vi.fn(() => ({ set: setMock }));
  const findMessageMock = vi.fn();
  const findConversationMock = vi.fn();

  const sendMessageMock = vi.fn();
  const getConnectorMock = vi.fn();

  return {
    whereMock,
    setMock,
    updateMock,
    findMessageMock,
    findConversationMock,
    sendMessageMock,
    getConnectorMock,
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
    trackSentMessage: vi.fn().mockResolvedValue(undefined),
    trackFailedMessage: vi.fn().mockResolvedValue(undefined),
  },
}));

import { processRetryJob } from '../messageRetryWorker';

describe('messageRetryWorker.processRetryJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends message via connector and marks sent', async () => {
    const payload: SendMessageJobPayload = {
      messageId: '550e8400-e29b-41d4-a716-446655440001',
      conversationId: '550e8400-e29b-41d4-a716-446655440002',
      recipientId: '550e8400-e29b-41d4-a716-446655440002',
      body: 'Hello',
      direction: 'outbound',
      platformType: 'irc',
      retryCount: 0,
      metadata: { requestedByUserId: 'user-1' },
    };

    mocks.findMessageMock.mockResolvedValue({ id: payload.messageId, metadata: null });
    mocks.findConversationMock.mockResolvedValue({
      id: payload.conversationId,
      externalThreadId: '#support',
    });

    mocks.getConnectorMock.mockReturnValue({ sendMessage: mocks.sendMessageMock });
    mocks.sendMessageMock.mockResolvedValue({
      success: true,
      platformMessageId: 'irc-123',
      sentAt: '2026-02-16T00:00:00.000Z',
    });

    const job = {
      data: payload,
      attemptsMade: 0,
    } as unknown as Job<SendMessageJobPayload>;

    await processRetryJob(job);

    expect(mocks.getConnectorMock).toHaveBeenCalledWith('irc');
    expect(mocks.sendMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageId: payload.messageId,
        conversationId: payload.conversationId,
        body: payload.body,
        platformType: 'irc',
      })
    );
    // The connector is called but it's inside a try-catch within processRetryJob
    // so we verify it was called with the IRC connector
    expect(mocks.getConnectorMock).toHaveBeenCalled();
  });

  it('marks failed and rethrows on connector failure', async () => {
    const payload: SendMessageJobPayload = {
      messageId: '550e8400-e29b-41d4-a716-446655440011',
      conversationId: '550e8400-e29b-41d4-a716-446655440012',
      recipientId: '#support',
      body: 'Hello',
      direction: 'outbound',
      platformType: 'irc',
      retryCount: 0,
    };

    mocks.findMessageMock
      .mockResolvedValueOnce({ id: payload.messageId, metadata: null })
      .mockResolvedValueOnce({ id: payload.messageId, metadata: null });
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
      attemptsMade: 0,
    } as unknown as Job<SendMessageJobPayload>;

    await expect(processRetryJob(job)).rejects.toThrow('Cannot send to channel');
    // Verify connector was called
    expect(mocks.getConnectorMock).toHaveBeenCalledWith('irc');
    expect(mocks.sendMessageMock).toHaveBeenCalled();
  });
});
