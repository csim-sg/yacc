/**
 * Presence Handler Unit Tests
 *
 * Tests for presence event handler:
 * - presence.updated
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handlePresenceUpdated, clearUserPresence } from '../presence.handler';
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

describe('Presence Handler', () => {
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

  describe('handlePresenceUpdated', () => {
    it('should update user presence to online', () => {
      const event = {
        eventId: 'evt-1',
        userId: 'user-1',
        userName: 'Alice',
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      };

      handlePresenceUpdated(event);

      const store = useWebSocketStore.getState();
      const presence = store.userPresence.get('user-1');
      expect(presence?.status).toBe('online');
    });

    it('should update user presence to offline', () => {
      const event = {
        eventId: 'evt-1',
        userId: 'user-1',
        userName: 'Alice',
        status: 'offline' as const,
        lastSeen: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      };

      handlePresenceUpdated(event);

      const store = useWebSocketStore.getState();
      const presence = store.userPresence.get('user-1');
      expect(presence?.status).toBe('offline');
    });

    it('should update user presence to away', () => {
      const event = {
        eventId: 'evt-1',
        userId: 'user-1',
        userName: 'Alice',
        status: 'away' as const,
        lastSeen: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      };

      handlePresenceUpdated(event);

      const store = useWebSocketStore.getState();
      const presence = store.userPresence.get('user-1');
      expect(presence?.status).toBe('away');
    });

    it('should mark event as processed', () => {
      const event = {
        eventId: 'evt-1',
        userId: 'user-1',
        userName: 'Alice',
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      };

      handlePresenceUpdated(event);

      const store = useWebSocketStore.getState();
      expect(store.isEventProcessed('evt-1')).toBe(true);
    });

    it('should ignore duplicate presence.updated events', () => {
      const event = {
        eventId: 'evt-1',
        userId: 'user-1',
        userName: 'Alice',
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      };

      handlePresenceUpdated(event);
      const processedCount1 = useWebSocketStore.getState().processedEventIds.size;

      // Process same event again
      handlePresenceUpdated(event);
      const processedCount2 = useWebSocketStore.getState().processedEventIds.size;

      expect(processedCount1).toBe(processedCount2);
    });
  });

  describe('clearUserPresence', () => {
    it('should clear user presence', () => {
      const event = {
        eventId: 'evt-1',
        userId: 'user-1',
        userName: 'Alice',
        status: 'online' as const,
        lastSeen: new Date().toISOString(),
        timestamp: new Date().toISOString(),
      };

      handlePresenceUpdated(event);
      expect(useWebSocketStore.getState().userPresence.has('user-1')).toBe(true);

      clearUserPresence('user-1');
      expect(useWebSocketStore.getState().userPresence.has('user-1')).toBe(false);
    });
  });
});
