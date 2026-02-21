/**
 * Integration Tests for WebSocketClient
 *
 * Unit tests for WebSocketClient without complex mock setup
 *
 * @module @yacc/frontend/services/websocket/__tests__
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketClient, createWebSocketClient } from '../WebSocketClient';

// Simple mock
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connected: false,
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    onAny: vi.fn(),
    id: 'test-socket-id',
  })),
}));

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    client = createWebSocketClient(
      'ws://localhost:3000',
      'test-token',
      'user-123'
    );
  });

  afterEach(() => {
    client.disconnect();
    vi.clearAllMocks();
    consoleSpy.mockRestore();
  });

  describe('initialization', () => {
    it('should create client with correct configuration', () => {
      expect(client).toBeInstanceOf(WebSocketClient);
      expect(client.isConnected()).toBe(false);
    });

    it('should be created via factory function', () => {
      const factoryClient = createWebSocketClient(
        'ws://localhost:3000',
        'test-token'
      );
      expect(factoryClient).toBeInstanceOf(WebSocketClient);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('should subscribe to event', () => {
      const callback = vi.fn();
      client.subscribe('message.received', callback);

      expect(
        client.getEventHandler().hasSubscribers('message.received')
      ).toBe(true);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = client.subscribe('message.received', callback);

      unsubscribe();

      expect(
        client.getEventHandler().hasSubscribers('message.received')
      ).toBe(false);
    });

    it('should unsubscribe from event', () => {
      const callback = vi.fn();
      client.subscribe('message.received', callback);
      client.unsubscribe('message.received', callback);

      expect(
        client.getEventHandler().hasSubscribers('message.received')
      ).toBe(false);
    });

    it('should support multiple subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      client.subscribe('message.received', callback1);
      client.subscribe('message.received', callback2);

      expect(
        client.getEventHandler().getSubscriberCount('message.received')
      ).toBe(2);
    });
  });

  describe('event handling', () => {
    it('should deliver events to all subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const payload = { data: 'test' };

      client.subscribe('test.event', callback1);
      client.subscribe('test.event', callback2);

      // Emit via event handler directly
      client.getEventHandler().emit('test.event', payload);

      expect(callback1).toHaveBeenCalledWith(payload);
      expect(callback2).toHaveBeenCalledWith(payload);
    });

    it('should not deliver events after unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = client.subscribe('test.event', callback);

      unsubscribe();
      client.getEventHandler().emit('test.event', { data: 'test' });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should clear all event handlers on disconnect', () => {
      const callback = vi.fn();
      client.subscribe('test.event', callback);

      client.disconnect();

      expect(
        client.getEventHandler().hasSubscribers('test.event')
      ).toBe(false);
    });
  });

  describe('context management', () => {
    it('should update userId', () => {
      client.setUserId('new-user-456');
      // Should not throw
      expect(client).toBeDefined();
    });
  });

  describe('accessor methods', () => {
    it('should expose connection manager', () => {
      expect(client.getConnectionManager()).toBeDefined();
    });

    it('should expose event handler', () => {
      expect(client.getEventHandler()).toBeDefined();
    });

    it('should expose logger', () => {
      expect(client.getLogger()).toBeDefined();
    });
  });

  describe('backlog management', () => {
    it('should start with empty backlog', () => {
      expect(client.getConnectionManager().getBacklogLength()).toBe(0);
    });

    it('should store events in backlog', () => {
      client.getConnectionManager().storeEventBacklog({
        type: 'test.event',
        payload: { data: 'test' },
        timestamp: Date.now(),
      });

      expect(client.getConnectionManager().getBacklogLength()).toBe(1);
    });
  });
});
