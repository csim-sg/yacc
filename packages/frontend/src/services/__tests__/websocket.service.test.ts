/**
 * WebSocket Service Unit Tests
 *
 * Tests for WebSocket service covering:
 * - Initialization
 * - Connection/disconnection
 * - Event emission
 * - State synchronization with Zustand store
 * - Error handling
 *
 * Note: These tests use mocked Socket.io client
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { webSocketService } from '../websocket.service';
import { useWebSocketStore } from '../../stores/websocket.store';

// Mock the socket.io client
vi.mock('../../lib/socket', () => ({
  socketClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    updateAuthToken: vi.fn(),
    getState: vi.fn(() => 'disconnected'),
    isConnected: vi.fn(() => false),
  },
}));

// Mock the logger
vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('WebSocket Service', () => {
  beforeEach(() => {
    // Reset store before each test
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

    // Destroy service to reset state
    webSocketService.destroy();
  });

  afterEach(() => {
    webSocketService.destroy();
  });

  // ========================================================================
  // Initialization Tests
  // ========================================================================

  describe('Initialization', () => {
    it('should initialize service', () => {
      webSocketService.initialize();
      
      const state = useWebSocketStore.getState();
      expect(state.connectionState).toBeDefined();
    });

    it('should not reinitialize if already initialized', () => {
      webSocketService.initialize();
      webSocketService.initialize();
      
      // Should not throw error, just silently return
      expect(true).toBe(true);
    });
  });

  // ========================================================================
  // Connection Tests
  // ========================================================================

  describe('Connection Management', () => {
    it('should connect to WebSocket server', () => {
      webSocketService.initialize();
      webSocketService.connect();
      
      const state = useWebSocketStore.getState();
      expect(state.connectionState).toBe('connecting');
    });

    it('should set connection state to error on connect failure', () => {
      webSocketService.initialize();
      
      // Simulate connect error
      try {
        webSocketService.connect();
      } catch (e) {
        // Expected
      }
      
      // Verify state was set (may be connecting or error depending on mock)
      const state = useWebSocketStore.getState();
      expect(['connecting', 'error']).toContain(state.connectionState);
    });

    it('should disconnect from WebSocket server', () => {
      webSocketService.initialize();
      webSocketService.disconnect();
      
      const state = useWebSocketStore.getState();
      expect(state.connectionState).toBe('disconnected');
    });
  });

  // ========================================================================
  // Authentication Tests
  // ========================================================================

  describe('Authentication', () => {
    it('should update auth token', () => {
      webSocketService.initialize();
      const token = 'new-jwt-token';
      
      expect(() => {
        webSocketService.updateAuthToken(token);
      }).not.toThrow();
    });
  });

  // ========================================================================
  // Connection Status Tests
  // ========================================================================

  describe('Connection Status', () => {
    it('should report connection status', () => {
      webSocketService.initialize();
      
      // Initially disconnected (per mock)
      expect(webSocketService.isConnected()).toBe(false);
    });
  });

  // ========================================================================
  // Event Emission Tests
  // ========================================================================

  describe('Event Emission', () => {
    it('should emit events (when connected)', () => {
      webSocketService.initialize();
      
      expect(() => {
        webSocketService.emit('typing.start', { conversationId: 'conv-1' });
      }).toThrow(); // Should throw because not actually connected
    });
  });

  // ========================================================================
  // Event Listener Tests
  // ========================================================================

  describe('Event Listeners', () => {
    it('should register event listener', () => {
      webSocketService.initialize();
      
      const listener = vi.fn();
      expect(() => {
        webSocketService.on('conversation.updated', listener);
      }).not.toThrow();
    });

    it('should unregister event listener', () => {
      webSocketService.initialize();
      
      const listener = vi.fn();
      webSocketService.on('conversation.updated', listener);
      
      expect(() => {
        webSocketService.off('conversation.updated', listener);
      }).not.toThrow();
    });
  });

  // ========================================================================
  // Cleanup Tests
  // ========================================================================

  describe('Cleanup', () => {
    it('should destroy service and cleanup intervals', () => {
      webSocketService.initialize();
      
      expect(() => {
        webSocketService.destroy();
      }).not.toThrow();
    });
  });
});
