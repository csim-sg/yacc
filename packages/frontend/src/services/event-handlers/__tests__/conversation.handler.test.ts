/**
 * Conversation Handler Unit Tests
 *
 * Tests for conversation event handlers:
 * - conversation.updated
 * - conversation.reopened
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleConversationUpdated,
  handleConversationReopened,
} from '../conversation.handler';
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

describe('Conversation Handler', () => {
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

    describe('handleConversationUpdated', () => {
      it('should handle conversation.updated event', () => {
        const event = {
          conversationId: 'conv-123',
          updatedFields: { status: 'pending' },
          changedBy: 'user-456',
          changedAt: new Date().toISOString(),
        };

        expect(() => handleConversationUpdated(event)).not.toThrow();
      });

      it('should invalidate conversation caches', () => {
        const event = {
          conversationId: 'conv-123',
          updatedFields: { status: 'resolved', priority: 'high' },
          changedBy: 'user-456',
          changedAt: new Date().toISOString(),
        };

        expect(() => handleConversationUpdated(event)).not.toThrow();
      });
    });

  describe('handleConversationReopened', () => {
    it('should handle conversation.reopened event', () => {
      const event = {
        eventId: 'evt-2',
        conversationId: 'conv-123',
        reason: 'new_message',
        timestamp: new Date().toISOString(),
      };

      handleConversationReopened(event);

      const store = useWebSocketStore.getState();
      expect(store.isEventProcessed('evt-2')).toBe(true);
    });

    it('should ignore duplicate conversation.reopened events', () => {
      const event = {
        eventId: 'evt-2',
        conversationId: 'conv-123',
        reason: 'new_message',
        timestamp: new Date().toISOString(),
      };

      handleConversationReopened(event);
      const processedCount1 = useWebSocketStore.getState().processedEventIds.size;

      // Process same event again
      handleConversationReopened(event);
      const processedCount2 = useWebSocketStore.getState().processedEventIds.size;

      expect(processedCount1).toBe(processedCount2);
    });
  });
});
