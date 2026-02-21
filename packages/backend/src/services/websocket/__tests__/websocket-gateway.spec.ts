/**
 * WebSocket Gateway Service Tests
 *
 * Tests the gateway initialization, event emission, and room subscription methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WebSocketServer } from '../../../websockets/websocket.server';
import {
  setWebSocketGateway,
  getWebSocketGateway,
  isWebSocketGatewayAvailable,
  emitToConversation,
  emitToUser,
  emitGlobally,
  subscribeToConversation,
  unsubscribeFromConversation,
  isSubscribedToConversation,
  getConversationSubscribers,
} from '../websocket-gateway';

// Mock logger to avoid appConfig parsing
vi.mock('../../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

/**
 * Mock WebSocket server
 */
const createMockGateway = (): WebSocketServer => {
  return {
    emitToConversation: vi.fn(),
    emitToUser: vi.fn(),
    emitGlobally: vi.fn(),
    subscribeToConversation: vi.fn(),
    unsubscribeFromConversation: vi.fn(),
    isSubscribedToConversation: vi.fn().mockReturnValue(false),
    getConversationSubscribers: vi.fn().mockReturnValue(new Set()),
    getConnectedUserIds: vi.fn().mockReturnValue([]),
  } as unknown as WebSocketServer;
};

describe('WebSocket Gateway', () => {
  // ============================================
  // Initialization Tests
  // ============================================

  describe('Gateway Initialization', () => {
    it('should set gateway instance', () => {
      const mockGateway = createMockGateway();
      setWebSocketGateway(mockGateway);

      const retrieved = getWebSocketGateway();
      expect(retrieved).toBe(mockGateway);
    });

    it('should report gateway as available after initialization', () => {
      const mockGateway = createMockGateway();
      setWebSocketGateway(mockGateway);

      expect(isWebSocketGatewayAvailable()).toBe(true);
    });

    it('should allow multiple setWebSocketGateway calls', () => {
      const mockGateway1 = createMockGateway();
      const mockGateway2 = createMockGateway();

      setWebSocketGateway(mockGateway1);
      expect(getWebSocketGateway()).toBe(mockGateway1);

      setWebSocketGateway(mockGateway2);
      expect(getWebSocketGateway()).toBe(mockGateway2);
    });
  });

  // ============================================
  // Event Emission Tests
  // ============================================

  describe('emitToConversation', () => {
    let mockGateway: WebSocketServer;

    beforeEach(() => {
      mockGateway = createMockGateway();
      setWebSocketGateway(mockGateway);
    });

    it('should emit message.sent event to conversation', async () => {
      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      await emitToConversation('550e8400-e29b-41d4-a716-446655440001', 'message.sent', payload);

      expect(mockGateway.emitToConversation).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440001',
        'message.sent',
        payload
      );
    });

    it('should emit typing.started event to conversation', async () => {
      const payload = {
        conversationId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        name: 'John Doe',
      };

      await emitToConversation('550e8400-e29b-41d4-a716-446655440000', 'typing.started', payload);

      expect(mockGateway.emitToConversation).toHaveBeenCalled();
    });

    it('should handle gateway not initialized', async () => {
      const mockGateway2 = createMockGateway();
      setWebSocketGateway(mockGateway2);

      const payload = {
        messageId: '550e8400-e29b-41d4-a716-446655440000',
        conversationId: '550e8400-e29b-41d4-a716-446655440001',
        status: 'sent' as const,
        sentAt: new Date().toISOString(),
      };

      // This should not throw even if gateway method fails
      vi.mocked(mockGateway2.emitToConversation).mockImplementationOnce(() => {
        throw new Error('Gateway error');
      });

      await expect(
        emitToConversation('550e8400-e29b-41d4-a716-446655440001', 'message.sent', payload)
      ).rejects.toThrow();
    });
  });

  describe('emitToUser', () => {
    let mockGateway: WebSocketServer;

    beforeEach(() => {
      mockGateway = createMockGateway();
      setWebSocketGateway(mockGateway);
    });

    it('should emit presence.updated event to user', async () => {
      const payload = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
      };

      await emitToUser('550e8400-e29b-41d4-a716-446655440000', 'presence.updated', payload);

      expect(mockGateway.emitToUser).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        'presence.updated',
        payload
      );
    });
  });

  describe('emitGlobally', () => {
    let mockGateway: WebSocketServer;

    beforeEach(() => {
      mockGateway = createMockGateway();
      setWebSocketGateway(mockGateway);
    });

    it('should emit presence.updated event globally', async () => {
      const payload = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
      };

      await emitGlobally('presence.updated', payload);

      expect(mockGateway.emitGlobally).toHaveBeenCalledWith('presence.updated', payload);
    });
  });

  // ============================================
  // Room Subscription Tests
  // ============================================

  describe('subscribeToConversation', () => {
    let mockGateway: WebSocketServer;

    beforeEach(() => {
      mockGateway = createMockGateway();
      setWebSocketGateway(mockGateway);
    });

    it('should subscribe user to conversation', () => {
      subscribeToConversation('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001');

      expect(mockGateway.subscribeToConversation).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001'
      );
    });

    it('should handle subscription errors gracefully', () => {
      vi.mocked(mockGateway.subscribeToConversation).mockImplementationOnce(() => {
        throw new Error('User not connected');
      });

      // Should not throw
      expect(() =>
        subscribeToConversation('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001')
      ).not.toThrow();

      expect(mockGateway.subscribeToConversation).toHaveBeenCalled();
    });
  });

  describe('unsubscribeFromConversation', () => {
    let mockGateway: WebSocketServer;

    beforeEach(() => {
      mockGateway = createMockGateway();
      setWebSocketGateway(mockGateway);
    });

    it('should unsubscribe user from conversation', () => {
      unsubscribeFromConversation('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001');

      expect(mockGateway.unsubscribeFromConversation).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001'
      );
    });
  });

  describe('isSubscribedToConversation', () => {
    let mockGateway: WebSocketServer;

    beforeEach(() => {
      mockGateway = createMockGateway();
      setWebSocketGateway(mockGateway);
    });

    it('should check if user is subscribed to conversation', () => {
      vi.mocked(mockGateway.isSubscribedToConversation).mockReturnValueOnce(true);

      const result = isSubscribedToConversation('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001');

      expect(result).toBe(true);
      expect(mockGateway.isSubscribedToConversation).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001'
      );
    });

    it('should return false if not subscribed', () => {
      vi.mocked(mockGateway.isSubscribedToConversation).mockReturnValueOnce(false);

      const result = isSubscribedToConversation('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001');

      expect(result).toBe(false);
    });

    it('should return false on error', () => {
      vi.mocked(mockGateway.isSubscribedToConversation).mockImplementationOnce(() => {
        throw new Error('Gateway error');
      });

      const result = isSubscribedToConversation('550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001');

      expect(result).toBe(false);
    });
  });

  describe('getConversationSubscribers', () => {
    let mockGateway: WebSocketServer;

    beforeEach(() => {
      mockGateway = createMockGateway();
      setWebSocketGateway(mockGateway);
    });

    it('should get all subscribers for a conversation', () => {
      const subscribers = new Set(['user1', 'user2', 'user3']);
      vi.mocked(mockGateway.getConversationSubscribers).mockReturnValueOnce(subscribers);

      const result = getConversationSubscribers('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual(subscribers);
      expect(mockGateway.getConversationSubscribers).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
    });

    it('should return empty set if no subscribers', () => {
      vi.mocked(mockGateway.getConversationSubscribers).mockReturnValueOnce(new Set());

      const result = getConversationSubscribers('550e8400-e29b-41d4-a716-446655440000');

      expect(result.size).toBe(0);
    });

    it('should return empty set on error', () => {
      vi.mocked(mockGateway.getConversationSubscribers).mockImplementationOnce(() => {
        throw new Error('Gateway error');
      });

      const result = getConversationSubscribers('550e8400-e29b-41d4-a716-446655440000');

      expect(result.size).toBe(0);
    });
  });
});
