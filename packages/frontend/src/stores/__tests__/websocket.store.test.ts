/**
 * WebSocket Store Unit Tests
 *
 * Tests for Zustand websocket store covering:
 * - Connection state management
 * - Subscription management
 * - Typing indicators
 * - User presence
 * - Event deduplication
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useWebSocketStore, useWebSocketStatus, useTypingUsers, useUserPresence } from '../websocket.store';

describe('WebSocket Store', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
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

  // ========================================================================
  // Connection State Tests
  // ========================================================================

  describe('Connection State Management', () => {
    it('should initialize with disconnected state', () => {
      const state = useWebSocketStore.getState();
      expect(state.connectionState).toBe('disconnected');
      expect(state.lastConnectTime).toBeNull();
      expect(state.lastErrorMessage).toBeNull();
      expect(state.reconnectAttempts).toBe(0);
    });

    it('should update connection state', () => {
      const { setConnectionState } = useWebSocketStore.getState();
      
      setConnectionState('connecting');
      expect(useWebSocketStore.getState().connectionState).toBe('connecting');
      
      setConnectionState('connected');
      expect(useWebSocketStore.getState().connectionState).toBe('connected');
      
      setConnectionState('error');
      expect(useWebSocketStore.getState().connectionState).toBe('error');
    });

    it('should set last connect time', () => {
      const { setLastConnectTime } = useWebSocketStore.getState();
      const now = new Date().toISOString();
      
      setLastConnectTime(now);
      expect(useWebSocketStore.getState().lastConnectTime).toBe(now);
    });

    it('should set error message', () => {
      const { setLastErrorMessage } = useWebSocketStore.getState();
      
      setLastErrorMessage('Connection timeout');
      expect(useWebSocketStore.getState().lastErrorMessage).toBe('Connection timeout');
      
      setLastErrorMessage(null);
      expect(useWebSocketStore.getState().lastErrorMessage).toBeNull();
    });

    it('should track reconnection attempts', () => {
      const { setReconnectAttempts } = useWebSocketStore.getState();
      
      setReconnectAttempts(1);
      expect(useWebSocketStore.getState().reconnectAttempts).toBe(1);
      
      setReconnectAttempts(5);
      expect(useWebSocketStore.getState().reconnectAttempts).toBe(5);
    });
  });

  // ========================================================================
  // Subscription Tests
  // ========================================================================

  describe('Conversation Subscriptions', () => {
    it('should subscribe to a conversation', () => {
      const { subscribe } = useWebSocketStore.getState();
      const conversationId = 'conv-123';
      
      subscribe(conversationId);
      
      const state = useWebSocketStore.getState();
      expect(state.subscribedConversationIds.has(conversationId)).toBe(true);
    });

    it('should subscribe to multiple conversations', () => {
      const { subscribe } = useWebSocketStore.getState();
      const conv1 = 'conv-1';
      const conv2 = 'conv-2';
      const conv3 = 'conv-3';
      
      subscribe(conv1);
      subscribe(conv2);
      subscribe(conv3);
      
      const state = useWebSocketStore.getState();
      expect(state.subscribedConversationIds.size).toBe(3);
      expect(state.subscribedConversationIds.has(conv1)).toBe(true);
      expect(state.subscribedConversationIds.has(conv2)).toBe(true);
      expect(state.subscribedConversationIds.has(conv3)).toBe(true);
    });

    it('should not add duplicate subscriptions', () => {
      const { subscribe } = useWebSocketStore.getState();
      const conversationId = 'conv-123';
      
      subscribe(conversationId);
      subscribe(conversationId);
      
      const state = useWebSocketStore.getState();
      expect(state.subscribedConversationIds.size).toBe(1);
    });

    it('should unsubscribe from a conversation', () => {
      const { subscribe, unsubscribe } = useWebSocketStore.getState();
      const conversationId = 'conv-123';
      
      subscribe(conversationId);
      expect(useWebSocketStore.getState().subscribedConversationIds.has(conversationId)).toBe(true);
      
      unsubscribe(conversationId);
      expect(useWebSocketStore.getState().subscribedConversationIds.has(conversationId)).toBe(false);
    });

    it('should clear typing users when unsubscribing', () => {
      const { subscribe, unsubscribe, addTypingUser } = useWebSocketStore.getState();
      const conversationId = 'conv-123';
      
      subscribe(conversationId);
      addTypingUser(conversationId, 'user-1', 'Alice');
      
      let state = useWebSocketStore.getState();
      expect(state.typingUsers.get(conversationId)?.size).toBe(1);
      
      unsubscribe(conversationId);
      
      state = useWebSocketStore.getState();
      expect(state.typingUsers.has(conversationId)).toBe(false);
    });
  });

  // ========================================================================
  // Typing Indicator Tests
  // ========================================================================

  describe('Typing Indicators', () => {
    it('should add typing user', () => {
      const { addTypingUser } = useWebSocketStore.getState();
      const conversationId = 'conv-123';
      const userId = 'user-1';
      const userName = 'Alice';
      
      addTypingUser(conversationId, userId, userName);
      
      const state = useWebSocketStore.getState();
      const typing = state.typingUsers.get(conversationId);
      expect(typing?.get(userId)).toBeDefined();
      expect(typing?.get(userId)?.userName).toBe('Alice');
    });

    it('should add multiple typing users to same conversation', () => {
      const { addTypingUser } = useWebSocketStore.getState();
      const conversationId = 'conv-123';
      
      addTypingUser(conversationId, 'user-1', 'Alice');
      addTypingUser(conversationId, 'user-2', 'Bob');
      addTypingUser(conversationId, 'user-3', 'Charlie');
      
      const state = useWebSocketStore.getState();
      const typing = state.typingUsers.get(conversationId);
      expect(typing?.size).toBe(3);
    });

    it('should remove typing user', () => {
      const { addTypingUser, removeTypingUser } = useWebSocketStore.getState();
      const conversationId = 'conv-123';
      
      addTypingUser(conversationId, 'user-1', 'Alice');
      expect(useWebSocketStore.getState().typingUsers.get(conversationId)?.size).toBe(1);
      
      removeTypingUser(conversationId, 'user-1');
      expect(useWebSocketStore.getState().typingUsers.has(conversationId)).toBe(false);
    });

    it('should remove specific typing user while keeping others', () => {
      const { addTypingUser, removeTypingUser } = useWebSocketStore.getState();
      const conversationId = 'conv-123';
      
      addTypingUser(conversationId, 'user-1', 'Alice');
      addTypingUser(conversationId, 'user-2', 'Bob');
      
      removeTypingUser(conversationId, 'user-1');
      
      const state = useWebSocketStore.getState();
      const typing = state.typingUsers.get(conversationId);
      expect(typing?.size).toBe(1);
      expect(typing?.has('user-1')).toBe(false);
      expect(typing?.has('user-2')).toBe(true);
    });

    it('should clear all typing users for conversation', () => {
      const { addTypingUser, clearTypingUsers } = useWebSocketStore.getState();
      const conversationId = 'conv-123';
      
      addTypingUser(conversationId, 'user-1', 'Alice');
      addTypingUser(conversationId, 'user-2', 'Bob');
      
      clearTypingUsers(conversationId);
      
      const state = useWebSocketStore.getState();
      expect(state.typingUsers.has(conversationId)).toBe(false);
    });
  });

  // ========================================================================
  // Presence Tests
  // ========================================================================

  describe('User Presence', () => {
    it('should set user presence to online', () => {
      const { setUserPresence } = useWebSocketStore.getState();
      
      setUserPresence('user-1', 'online');
      
      const state = useWebSocketStore.getState();
      const presence = state.userPresence.get('user-1');
      expect(presence?.status).toBe('online');
    });

    it('should set user presence to offline', () => {
      const { setUserPresence } = useWebSocketStore.getState();
      
      setUserPresence('user-1', 'offline');
      
      const state = useWebSocketStore.getState();
      const presence = state.userPresence.get('user-1');
      expect(presence?.status).toBe('offline');
    });

    it('should set user presence to away', () => {
      const { setUserPresence } = useWebSocketStore.getState();
      
      setUserPresence('user-1', 'away');
      
      const state = useWebSocketStore.getState();
      const presence = state.userPresence.get('user-1');
      expect(presence?.status).toBe('away');
    });

    it('should update presence with last seen time', () => {
      const { setUserPresence } = useWebSocketStore.getState();
      const lastSeen = new Date().toISOString();
      
      setUserPresence('user-1', 'offline', lastSeen);
      
      const state = useWebSocketStore.getState();
      const presence = state.userPresence.get('user-1');
      expect(presence?.lastSeen).toBe(lastSeen);
    });

    it('should clear user presence', () => {
      const { setUserPresence, clearUserPresence } = useWebSocketStore.getState();
      
      setUserPresence('user-1', 'online');
      expect(useWebSocketStore.getState().userPresence.has('user-1')).toBe(true);
      
      clearUserPresence('user-1');
      expect(useWebSocketStore.getState().userPresence.has('user-1')).toBe(false);
    });

    it('should track multiple user presence', () => {
      const { setUserPresence } = useWebSocketStore.getState();
      
      setUserPresence('user-1', 'online');
      setUserPresence('user-2', 'away');
      setUserPresence('user-3', 'offline');
      
      const state = useWebSocketStore.getState();
      expect(state.userPresence.size).toBe(3);
    });
  });

  // ========================================================================
  // Event Deduplication Tests
  // ========================================================================

  describe('Event Deduplication', () => {
    it('should mark event as processed', () => {
      const { markEventProcessed } = useWebSocketStore.getState();
      const eventId = 'event-123';
      
      markEventProcessed(eventId);
      
      const state = useWebSocketStore.getState();
      expect(state.processedEventIds.has(eventId)).toBe(true);
    });

    it('should check if event was processed', () => {
      const { markEventProcessed, isEventProcessed } = useWebSocketStore.getState();
      const eventId = 'event-123';
      
      expect(isEventProcessed(eventId)).toBe(false);
      
      markEventProcessed(eventId);
      
      expect(isEventProcessed(eventId)).toBe(true);
    });

    it('should track multiple processed events', () => {
      const { markEventProcessed } = useWebSocketStore.getState();
      
      markEventProcessed('event-1');
      markEventProcessed('event-2');
      markEventProcessed('event-3');
      
      const state = useWebSocketStore.getState();
      expect(state.processedEventIds.size).toBe(3);
    });
  });

  // ========================================================================
  // Derived Selector Tests
  // ========================================================================

  describe('Derived Selectors', () => {
    it('useWebSocketStatus should return connection status', () => {
      const { setConnectionState } = useWebSocketStore.getState();
      setConnectionState('connected');
      
      const status = useWebSocketStatus();
      expect(status.isConnected).toBe(true);
      expect(status.isConnecting).toBe(false);
      expect(status.isReconnecting).toBe(false);
      expect(status.isOffline).toBe(false);
    });

    it('useTypingUsers should return typing users for conversation', () => {
      const { addTypingUser } = useWebSocketStore.getState();
      const conversationId = 'conv-123';
      
      addTypingUser(conversationId, 'user-1', 'Alice');
      addTypingUser(conversationId, 'user-2', 'Bob');
      
      const typing = useTypingUsers(conversationId);
      expect(typing.length).toBe(2);
      expect(typing.some(t => t.userName === 'Alice')).toBe(true);
      expect(typing.some(t => t.userName === 'Bob')).toBe(true);
    });

    it('useTypingUsers should return empty array for conversation with no typing users', () => {
      const conversationId = 'conv-empty';
      
      const typing = useTypingUsers(conversationId);
      expect(typing.length).toBe(0);
    });

    it('useUserPresence should return user presence', () => {
      const { setUserPresence } = useWebSocketStore.getState();
      setUserPresence('user-1', 'online');
      
      const presence = useUserPresence('user-1');
      expect(presence.status).toBe('online');
    });

    it('useUserPresence should return unknown for non-existent user', () => {
      const presence = useUserPresence('non-existent');
      expect(presence.status).toBe('unknown');
    });
  });
});
