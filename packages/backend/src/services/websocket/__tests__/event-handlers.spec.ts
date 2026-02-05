/**
 * WebSocket Event Handlers Unit Tests
 *
 * Tests all 8 event handler functions with valid/invalid payloads
 * Verifies correct Socket.io broadcasting behavior
 *
 * NOTE: These tests mock logger to avoid appConfig environment variable requirements
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Server } from 'socket.io';

// Mock logger to avoid appConfig parsing
vi.mock('../../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { handleConversationUpdated } from '../conversation.handler';
import { handleMessageSent, handleMessageFailed } from '../message.handler';
import { handleTypingStarted, handleTypingStopped } from '../typing.handler';
import { handlePresenceUpdated } from '../presence.handler';
import { handleReactionAdded, handleReactionRemoved } from '../reaction.handler';

/**
 * Mock Socket.io server
 */
const createMockIO = (): Server => {
  return {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
    on: vi.fn(),
  } as unknown as Server;
};

// ============================================
// Conversation.updated Tests
// ============================================

describe('handleConversationUpdated', () => {
  let mockIO: Server;

  beforeEach(() => {
    mockIO = createMockIO();
    vi.clearAllMocks();
  });

  it('should broadcast conversation.updated with valid payload', async () => {
    const payload = {
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      updatedFields: { status: 'pending', priority: 'high' },
      changedBy: '550e8400-e29b-41d4-a716-446655440001',
      changedAt: new Date().toISOString(),
    };

    await handleConversationUpdated(mockIO, payload);

    expect(mockIO.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440000');
    expect(mockIO.emit).toHaveBeenCalledWith('conversation.updated', expect.objectContaining({
      conversationId: payload.conversationId,
      changedBy: payload.changedBy,
    }));
  });

  it('should reject invalid conversation ID', async () => {
    const payload = {
      conversationId: 'invalid-uuid',
      updatedFields: { status: 'pending' },
      changedBy: '550e8400-e29b-41d4-a716-446655440001',
      changedAt: new Date().toISOString(),
    };

    await expect(handleConversationUpdated(mockIO, payload)).rejects.toThrow();
  });

  it('should reject missing changedBy', async () => {
    const payload = {
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      updatedFields: { status: 'pending' },
      changedAt: new Date().toISOString(),
    };

    await expect(handleConversationUpdated(mockIO, payload)).rejects.toThrow();
  });
});

// ============================================
// Message.sent Tests
// ============================================

describe('handleMessageSent', () => {
  let mockIO: Server;

  beforeEach(() => {
    mockIO = createMockIO();
    vi.clearAllMocks();
  });

  it('should broadcast message.sent with valid payload', async () => {
    const payload = {
      messageId: '550e8400-e29b-41d4-a716-446655440000',
      conversationId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'sent' as const,
      sentAt: new Date().toISOString(),
    };

    await handleMessageSent(mockIO, payload);

    expect(mockIO.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440001');
    expect(mockIO.emit).toHaveBeenCalledWith('message.sent', expect.objectContaining({
      messageId: payload.messageId,
      status: 'sent',
    }));
  });

  it('should reject invalid message ID', async () => {
    const payload = {
      messageId: 'invalid-id',
      conversationId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'sent',
      sentAt: new Date().toISOString(),
    };

    await expect(handleMessageSent(mockIO, payload)).rejects.toThrow();
  });
});

// ============================================
// Message.failed Tests
// ============================================

describe('handleMessageFailed', () => {
  let mockIO: Server;

  beforeEach(() => {
    mockIO = createMockIO();
    vi.clearAllMocks();
  });

  it('should broadcast message.failed with valid payload', async () => {
    const payload = {
      messageId: '550e8400-e29b-41d4-a716-446655440000',
      conversationId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'failed' as const,
      error: 'Network timeout',
      retryAt: new Date().toISOString(),
      attempt: 1,
    };

    await handleMessageFailed(mockIO, payload);

    expect(mockIO.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440001');
    expect(mockIO.emit).toHaveBeenCalledWith('message.failed', expect.objectContaining({
      messageId: payload.messageId,
      status: 'failed',
      attempt: 1,
    }));
  });

  it('should reject attempt > 3', async () => {
    const payload = {
      messageId: '550e8400-e29b-41d4-a716-446655440000',
      conversationId: '550e8400-e29b-41d4-a716-446655440001',
      status: 'failed' as const,
      error: 'Network timeout',
      retryAt: new Date().toISOString(),
      attempt: 4,
    };

    await expect(handleMessageFailed(mockIO, payload)).rejects.toThrow();
  });
});

// ============================================
// Typing.started Tests
// ============================================

describe('handleTypingStarted', () => {
  let mockIO: Server;

  beforeEach(() => {
    mockIO = createMockIO();
    vi.clearAllMocks();
  });

  it('should broadcast typing.started with valid payload', async () => {
    const payload = {
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      name: 'John Doe',
    };

    await handleTypingStarted(mockIO, payload);

    expect(mockIO.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440000');
    expect(mockIO.emit).toHaveBeenCalledWith('typing.started', expect.objectContaining({
      userId: payload.userId,
      name: 'John Doe',
    }));
  });

  it('should reject empty name', async () => {
    const payload = {
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      name: '',
    };

    await expect(handleTypingStarted(mockIO, payload)).rejects.toThrow();
  });
});

// ============================================
// Typing.stopped Tests
// ============================================

describe('handleTypingStopped', () => {
  let mockIO: Server;

  beforeEach(() => {
    mockIO = createMockIO();
    vi.clearAllMocks();
  });

  it('should broadcast typing.stopped with valid payload', async () => {
    const payload = {
      conversationId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
    };

    await handleTypingStopped(mockIO, payload);

    expect(mockIO.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440000');
    expect(mockIO.emit).toHaveBeenCalledWith('typing.stopped', payload);
  });
});

// ============================================
// Presence.updated Tests
// ============================================

describe('handlePresenceUpdated', () => {
  let mockIO: Server;

  beforeEach(() => {
    mockIO = createMockIO();
    vi.clearAllMocks();
  });

  it('should broadcast presence.updated globally', async () => {
    const payload = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'online' as const,
      lastSeen: new Date().toISOString(),
    };

    await handlePresenceUpdated(mockIO, payload);

    // Presence updates are broadcast globally, not to a room
    expect(mockIO.emit).toHaveBeenCalledWith('presence.updated', expect.objectContaining({
      userId: payload.userId,
      status: 'online',
    }));
  });

  it('should accept offline status', async () => {
    const payload = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'offline' as const,
      lastSeen: new Date().toISOString(),
    };

    await handlePresenceUpdated(mockIO, payload);

    expect(mockIO.emit).toHaveBeenCalledWith('presence.updated', expect.objectContaining({
      status: 'offline',
    }));
  });

  it('should reject invalid status', async () => {
    const payload = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'away',
      lastSeen: new Date().toISOString(),
    };

    await expect(handlePresenceUpdated(mockIO, payload)).rejects.toThrow();
  });
});

// ============================================
// Reaction.added Tests
// ============================================

describe('handleReactionAdded', () => {
  let mockIO: Server;

  beforeEach(() => {
    mockIO = createMockIO();
    vi.clearAllMocks();
  });

  it('should broadcast reaction.added with valid payload', async () => {
    const payload = {
      messageId: '550e8400-e29b-41d4-a716-446655440000',
      conversationId: '550e8400-e29b-41d4-a716-446655440001',
      emoji: '👍',
      userId: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Jane Doe',
    };

    await handleReactionAdded(mockIO, payload);

    expect(mockIO.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440001');
    expect(mockIO.emit).toHaveBeenCalledWith('reaction.added', expect.objectContaining({
      emoji: '👍',
    }));
  });

  it('should accept various emoji', async () => {
    const emojis = ['❤️', '😂', '🔥', '👏'];

    for (const emoji of emojis) {
      mockIO = createMockIO();
      vi.clearAllMocks();

      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        emoji,
        userId: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Jane Doe',
      };

      await handleReactionAdded(mockIO, payload);
      expect(mockIO.emit).toHaveBeenCalled();
    }
  });
});

// ============================================
// Reaction.removed Tests
// ============================================

describe('handleReactionRemoved', () => {
  let mockIO: Server;

  beforeEach(() => {
    mockIO = createMockIO();
    vi.clearAllMocks();
  });

  it('should broadcast reaction.removed with valid payload', async () => {
    const payload = {
      messageId: '550e8400-e29b-41d4-a716-446655440000',
      conversationId: '550e8400-e29b-41d4-a716-446655440001',
      emoji: '👍',
      userId: '550e8400-e29b-41d4-a716-446655440002',
    };

    await handleReactionRemoved(mockIO, payload);

    expect(mockIO.to).toHaveBeenCalledWith('conversation:550e8400-e29b-41d4-a716-446655440001');
    expect(mockIO.emit).toHaveBeenCalledWith('reaction.removed', payload);
  });

  it('should reject invalid emoji', async () => {
    const payload = {
      messageId: '550e8400-e29b-41d4-a716-446655440000',
      conversationId: '550e8400-e29b-41d4-a716-446655440001',
      emoji: 'not-an-emoji',
      userId: '550e8400-e29b-41d4-a716-446655440002',
    };

    await expect(handleReactionRemoved(mockIO, payload)).rejects.toThrow();
  });
});
