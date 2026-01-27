/**
 * Typing Handler Unit Tests
 *
 * Tests for typing event handlers:
 * - typing.started
 * - typing.stopped
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  handleTypingStarted,
  handleTypingStopped,
  clearAllTypingTimeouts,
} from '../typing.handler';
import { useWebSocketStore } from '../../../stores/websocket.store';

// Mock logger
vi.mock('../../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Typing Handler', () => {
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

    vi.clearAllTimers();
  });

  afterEach(() => {
    clearAllTypingTimeouts();
    vi.clearAllTimers();
  });

  describe('handleTypingStarted', () => {
    it('should add typing user', () => {
      const event = {
        eventId: 'evt-1',
        conversationId: 'conv-123',
        userId: 'user-1',
        userName: 'Alice',
        timestamp: new Date().toISOString(),
      };

      handleTypingStarted(event);

      const store = useWebSocketStore.getState();
      const typing = store.typingUsers.get('conv-123');
      expect(typing?.has('user-1')).toBe(true);
      expect(typing?.get('user-1')?.userName).toBe('Alice');
    });

    it('should mark event as processed', () => {
      const event = {
        eventId: 'evt-1',
        conversationId: 'conv-123',
        userId: 'user-1',
        userName: 'Alice',
        timestamp: new Date().toISOString(),
      };

      handleTypingStarted(event);

      const store = useWebSocketStore.getState();
      expect(store.isEventProcessed('evt-1')).toBe(true);
    });

    it('should ignore duplicate typing.started events', () => {
      const event = {
        eventId: 'evt-1',
        conversationId: 'conv-123',
        userId: 'user-1',
        userName: 'Alice',
        timestamp: new Date().toISOString(),
      };

      handleTypingStarted(event);
      let typing = useWebSocketStore.getState().typingUsers.get('conv-123');
      expect(typing?.size).toBe(1);

      // Process same event again
      handleTypingStarted(event);
      typing = useWebSocketStore.getState().typingUsers.get('conv-123');

      // Should still be 1 (no duplicate)
      expect(typing?.size).toBe(1);
    });
  });

  describe('handleTypingStopped', () => {
    it('should remove typing user', () => {
      const startEvent = {
        eventId: 'evt-1',
        conversationId: 'conv-123',
        userId: 'user-1',
        userName: 'Alice',
        timestamp: new Date().toISOString(),
      };

      const stopEvent = {
        eventId: 'evt-2',
        conversationId: 'conv-123',
        userId: 'user-1',
        timestamp: new Date().toISOString(),
      };

      handleTypingStarted(startEvent);
      expect(useWebSocketStore.getState().typingUsers.get('conv-123')?.size).toBe(1);

      handleTypingStopped(stopEvent);
      expect(useWebSocketStore.getState().typingUsers.has('conv-123')).toBe(false);
    });

    it('should mark event as processed', () => {
      const stopEvent = {
        eventId: 'evt-2',
        conversationId: 'conv-123',
        userId: 'user-1',
        timestamp: new Date().toISOString(),
      };

      handleTypingStopped(stopEvent);

      const store = useWebSocketStore.getState();
      expect(store.isEventProcessed('evt-2')).toBe(true);
    });

    it('should ignore duplicate typing.stopped events', () => {
      const stopEvent = {
        eventId: 'evt-2',
        conversationId: 'conv-123',
        userId: 'user-1',
        timestamp: new Date().toISOString(),
      };

      handleTypingStopped(stopEvent);
      const processedCount1 = useWebSocketStore.getState().processedEventIds.size;

      // Process same event again
      handleTypingStopped(stopEvent);
      const processedCount2 = useWebSocketStore.getState().processedEventIds.size;

      expect(processedCount1).toBe(processedCount2);
    });
  });

  describe('clearAllTypingTimeouts', () => {
    it('should clear all typing timeouts', () => {
      const event1 = {
        eventId: 'evt-1',
        conversationId: 'conv-1',
        userId: 'user-1',
        userName: 'Alice',
        timestamp: new Date().toISOString(),
      };

      const event2 = {
        eventId: 'evt-2',
        conversationId: 'conv-1',
        userId: 'user-2',
        userName: 'Bob',
        timestamp: new Date().toISOString(),
      };

      handleTypingStarted(event1);
      handleTypingStarted(event2);

      expect(useWebSocketStore.getState().typingUsers.get('conv-1')?.size).toBe(2);

      clearAllTypingTimeouts();

      // Timeouts should be cleared, but users should still be in store
      // (cleared when timeout fires, not when clearing timeouts)
      expect(useWebSocketStore.getState().typingUsers.get('conv-1')?.size).toBe(2);
    });
  });
});
