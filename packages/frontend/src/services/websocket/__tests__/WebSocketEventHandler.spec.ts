/**
 * Tests for WebSocketEventHandler
 *
 * @module @yacc/frontend/services/websocket/__tests__
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketEventHandler } from '../WebSocketEventHandler';

describe('WebSocketEventHandler', () => {
  let handler: WebSocketEventHandler;

  beforeEach(() => {
    handler = new WebSocketEventHandler();
  });

  describe('subscribe', () => {
    it('should subscribe to event', () => {
      const callback = vi.fn();
      const unsubscribe = handler.subscribe('test.event', callback);

      expect(typeof unsubscribe).toBe('function');
      expect(handler.hasSubscribers('test.event')).toBe(true);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = handler.subscribe('test.event', callback);

      unsubscribe();

      expect(handler.hasSubscribers('test.event')).toBe(false);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from event', () => {
      const callback = vi.fn();
      handler.subscribe('test.event', callback);
      handler.unsubscribe('test.event', callback);

      expect(handler.hasSubscribers('test.event')).toBe(false);
    });

    it('should not error when unsubscribing non-existent callback', () => {
      const callback = vi.fn();
      // Should not throw
      expect(() => handler.unsubscribe('nonexistent', callback)).not.toThrow();
    });
  });

  describe('emit', () => {
    it('should call all handlers for event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const payload = { data: 'test' };

      handler.subscribe('test.event', callback1);
      handler.subscribe('test.event', callback2);
      handler.emit('test.event', payload);

      expect(callback1).toHaveBeenCalledWith(payload);
      expect(callback2).toHaveBeenCalledWith(payload);
    });

    it('should not call handlers after unsubscribe', () => {
      const callback = vi.fn();
      handler.subscribe('test.event', callback);
      handler.unsubscribe('test.event', callback);
      handler.emit('test.event', {});

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle events with no subscribers', () => {
      // Should not throw
      expect(() => handler.emit('nonexistent.event', {})).not.toThrow();
    });
  });

  describe('unsubscribeAll', () => {
    it('should clear all subscribers for specific event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      handler.subscribe('event1', callback1);
      handler.subscribe('event2', callback2);

      handler.unsubscribeAll('event1');

      expect(handler.hasSubscribers('event1')).toBe(false);
      expect(handler.hasSubscribers('event2')).toBe(true);
    });

    it('should clear all subscribers when no event specified', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      handler.subscribe('event1', callback1);
      handler.subscribe('event2', callback2);

      handler.unsubscribeAll();

      expect(handler.hasSubscribers('event1')).toBe(false);
      expect(handler.hasSubscribers('event2')).toBe(false);
    });
  });

  describe('hasSubscribers', () => {
    it('should return false when no subscribers', () => {
      expect(handler.hasSubscribers('nonexistent')).toBe(false);
    });

    it('should return true when subscribers exist', () => {
      handler.subscribe('test.event', vi.fn());
      expect(handler.hasSubscribers('test.event')).toBe(true);
    });
  });

  describe('multiple subscribers', () => {
    it('should support multiple subscribers for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      handler.subscribe('test.event', callback1);
      handler.subscribe('test.event', callback2);
      handler.subscribe('test.event', callback3);

      handler.emit('test.event', { data: 'test' });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should remove only specific subscriber', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      handler.subscribe('test.event', callback1);
      handler.subscribe('test.event', callback2);
      handler.unsubscribe('test.event', callback1);

      handler.emit('test.event', {});

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle handler errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorCallback = () => {
        throw new Error('Handler error');
      };
      const successCallback = vi.fn();

      handler.subscribe('test.event', errorCallback);
      handler.subscribe('test.event', successCallback);

      // Should not throw
      expect(() => handler.emit('test.event', {})).not.toThrow();

      // Error should be logged
      expect(consoleSpy).toHaveBeenCalled();

      // Success callback should still be called
      expect(successCallback).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('getSubscriberCount', () => {
    it('should return correct subscriber count', () => {
      expect(handler.getSubscriberCount('test.event')).toBe(0);

      handler.subscribe('test.event', vi.fn());
      expect(handler.getSubscriberCount('test.event')).toBe(1);

      handler.subscribe('test.event', vi.fn());
      expect(handler.getSubscriberCount('test.event')).toBe(2);
    });
  });

  describe('getEventTypes', () => {
    it('should return all registered event types', () => {
      handler.subscribe('event1', vi.fn());
      handler.subscribe('event2', vi.fn());

      const eventTypes = handler.getEventTypes();

      expect(eventTypes).toContain('event1');
      expect(eventTypes).toContain('event2');
    });

    it('should return empty array when no events', () => {
      expect(handler.getEventTypes()).toEqual([]);
    });
  });
});
