/**
 * Notification Handler Unit Tests
 *
 * Tests for notification event handler:
 * - notification.received
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleNotificationReceived } from '../notification.handler';
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

describe('Notification Handler', () => {
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

  describe('handleNotificationReceived', () => {
    it('should handle notification.received event', () => {
      const event = {
        eventId: 'evt-1',
        notification: {
          id: 'notif-1',
          userId: 'user-1',
          type: 'assignment' as const,
          conversationId: 'conv-123',
          actorId: 'user-2',
          actorName: 'Bob',
          message: 'Assigned you to conversation',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      handleNotificationReceived(event);

      const store = useWebSocketStore.getState();
      expect(store.isEventProcessed('evt-1')).toBe(true);
    });

    it('should handle assignment notification', () => {
      const event = {
        eventId: 'evt-1',
        notification: {
          id: 'notif-1',
          userId: 'user-1',
          type: 'assignment' as const,
          conversationId: 'conv-123',
          actorId: 'user-2',
          actorName: 'Bob',
          message: 'Assigned you to conversation',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      handleNotificationReceived(event);

      const store = useWebSocketStore.getState();
      expect(store.isEventProcessed('evt-1')).toBe(true);
    });

    it('should handle mention notification', () => {
      const event = {
        eventId: 'evt-2',
        notification: {
          id: 'notif-2',
          userId: 'user-1',
          type: 'mention' as const,
          conversationId: 'conv-123',
          actorId: 'user-3',
          actorName: 'Charlie',
          message: '@user-1 mentioned you in a note',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      handleNotificationReceived(event);

      const store = useWebSocketStore.getState();
      expect(store.isEventProcessed('evt-2')).toBe(true);
    });

    it('should handle unread notification', () => {
      const event = {
        eventId: 'evt-3',
        notification: {
          id: 'notif-3',
          userId: 'user-1',
          type: 'unread' as const,
          conversationId: 'conv-123',
          message: 'New unread message',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      handleNotificationReceived(event);

      const store = useWebSocketStore.getState();
      expect(store.isEventProcessed('evt-3')).toBe(true);
    });

    it('should ignore duplicate notification.received events', () => {
      const event = {
        eventId: 'evt-1',
        notification: {
          id: 'notif-1',
          userId: 'user-1',
          type: 'assignment' as const,
          conversationId: 'conv-123',
          actorId: 'user-2',
          actorName: 'Bob',
          message: 'Assigned you to conversation',
          isRead: false,
          createdAt: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      handleNotificationReceived(event);
      const processedCount1 = useWebSocketStore.getState().processedEventIds.size;

      // Process same event again
      handleNotificationReceived(event);
      const processedCount2 = useWebSocketStore.getState().processedEventIds.size;

      expect(processedCount1).toBe(processedCount2);
    });
  });
});
