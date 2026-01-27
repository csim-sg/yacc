/**
 * Message Handler Unit Tests
 *
 * Tests for message event handlers:
 * - message.sent
 * - message.failed
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleMessageSent,
  handleMessageFailed,
} from '../message.handler';
import { useWebSocketStore } from '../../../stores/websocket.store';

// Mock queryClient
vi.mock('../../../lib/queryClient', () => ({
  queryClient: {
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Message Handler', () => {
  beforeEach(() => {
    // Reset store
    useWebSocketStore.setState({
      connectionState: 'disconnected',
      lastConnectTime: null,
      lastErrorMessage: null,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      subscribedConversationIds: new Set(),
      typingUsers: new Map(),
      userPresence: new Map(),
      processedEventIds: new Set(),
    });
  });

  describe('handleMessageSent', () => {
    it('should handle message.sent event', () => {
      const event = {
        eventId: 'evt-1',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        serverId: 'msg-server-123',
        status: 'sent' as const,
        timestamp: new Date().toISOString(),
      };

      handleMessageSent(event);

      const store = useWebSocketStore.getState();
      expect(store.isEventProcessed('evt-1')).toBe(true);
    });

    it('should ignore duplicate message.sent events', () => {
      const event = {
        eventId: 'evt-1',
        conversationId: 'conv-123',
        messageId: 'msg-123',
        serverId: 'msg-server-123',
        status: 'sent' as const,
        timestamp: new Date().toISOString(),
      };

      handleMessageSent(event);
      const processedCount1 = useWebSocketStore.getState().processedEventIds.size;

      // Process same event again
      handleMessageSent(event);
      const processedCount2 = useWebSocketStore.getState().processedEventIds.size;

      expect(processedCount1).toBe(processedCount2);
    });
  });

  describe('handleMessageFailed', () => {
    it('should handle message.failed event', () => {
      const event = {
        eventId: 'evt-2',
        conversationId: 'conv-123',
        messageId: 'msg-456',
        status: 'failed' as const,
        error: 'Network error',
        canRetry: true,
        timestamp: new Date().toISOString(),
      };

      handleMessageFailed(event);

      const store = useWebSocketStore.getState();
      expect(store.isEventProcessed('evt-2')).toBe(true);
    });

    it('should ignore duplicate message.failed events', () => {
      const event = {
        eventId: 'evt-2',
        conversationId: 'conv-123',
        messageId: 'msg-456',
        status: 'failed' as const,
        error: 'Network error',
        canRetry: true,
        timestamp: new Date().toISOString(),
      };

      handleMessageFailed(event);
      const processedCount1 = useWebSocketStore.getState().processedEventIds.size;

      // Process same event again
      handleMessageFailed(event);
      const processedCount2 = useWebSocketStore.getState().processedEventIds.size;

      expect(processedCount1).toBe(processedCount2);
    });
  });
});
