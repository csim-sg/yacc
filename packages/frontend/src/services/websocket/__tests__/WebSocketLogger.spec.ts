/**
 * Tests for WebSocketLogger
 *
 * @module @yacc/frontend/services/websocket/__tests__
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketLogger } from '../WebSocketLogger';

describe('WebSocketLogger', () => {
  let logger: WebSocketLogger;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logger = new WebSocketLogger('user-123', 'socket-456');
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('lifecycle events', () => {
    it('should log connection attempt as JSON', () => {
      logger.logConnectionAttempt(1);

      expect(consoleSpy).toHaveBeenCalled();
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('connection.attempt');
      expect(logged.level).toBe('info');
      expect(logged.tags.attempt_number).toBe(1);
    });

    it('should log connection success with duration', () => {
      logger.logConnectionSuccess(150);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('connection.success');
      expect(logged.duration_ms).toBe(150);
    });

    it('should log connection failure with error', () => {
      const error = new Error('Connection refused');
      logger.logConnectionFailure(error, 2);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('connection.failure');
      expect(logged.level).toBe('error');
      expect(logged.error.message).toBe('Connection refused');
      expect(logged.tags.attempt_number).toBe(2);
    });

    it('should log disconnect', () => {
      logger.logDisconnect();

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('connection.disconnect');
    });
  });

  describe('reconnection events', () => {
    it('should log reconnection attempt with backoff', () => {
      logger.logReconnectionAttempt(3, 4000);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('reconnection.attempt');
      expect(logged.tags.attempt_number).toBe(3);
      expect(logged.tags.backoff_delay_ms).toBe(4000);
    });

    it('should log reconnection success', () => {
      logger.logReconnectionSuccess(3);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('reconnection.success');
      expect(logged.tags.attempt_number).toBe(3);
    });

    it('should log reconnection failed', () => {
      logger.logReconnectionFailed();

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('reconnection.failed');
      expect(logged.level).toBe('error');
    });
  });

  describe('event processing', () => {
    it('should log event received with payload size', () => {
      logger.logEventReceived('message.received', 256);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('event.received');
      expect(logged.level).toBe('debug');
      expect(logged.tags.event_type).toBe('message.received');
      expect(logged.tags.payload_size_bytes).toBe(256);
    });

    it('should log event processed with timing', () => {
      logger.logEventProcessed('message.received', 5, 2);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('event.processed');
      expect(logged.duration_ms).toBe(5);
      expect(logged.tags.handler_count).toBe(2);
    });

    it('should log event error', () => {
      const error = new Error('Handler failed');
      logger.logEventError('message.received', error);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('event.error');
      expect(logged.level).toBe('error');
      expect(logged.error.message).toBe('Handler failed');
    });
  });

  describe('backlog events', () => {
    it('should log backlog replay', () => {
      logger.logBacklogReplayed(10, 50);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('backlog.replay');
      expect(logged.duration_ms).toBe(50);
      expect(logged.tags.backlog_size).toBe(10);
    });
  });

  describe('heartbeat events', () => {
    it('should log heartbeat missed', () => {
      logger.logHeartbeatMissed(120000);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.event).toBe('heartbeat.missed');
      expect(logged.level).toBe('warn');
      expect(logged.tags.time_since_last_ms).toBe(120000);
    });
  });

  describe('context management', () => {
    it('should include userId and socketId in logs', () => {
      logger.logConnectionAttempt(1);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.userId).toBe('user-123');
      expect(logged.socketId).toBe('socket-456');
    });

    it('should update userId', () => {
      logger.setUserId('new-user-789');
      logger.logConnectionAttempt(1);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.userId).toBe('new-user-789');
    });

    it('should update socketId', () => {
      logger.setSocketId('new-socket-012');
      logger.logConnectionAttempt(1);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.socketId).toBe('new-socket-012');
    });

    it('should get socketId', () => {
      expect(logger.getSocketId()).toBe('socket-456');

      logger.setSocketId('new-socket');
      expect(logger.getSocketId()).toBe('new-socket');
    });
  });

  describe('structured logging', () => {
    it('should include timestamp in ISO format', () => {
      logger.logConnectionAttempt(1);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.timestamp).toBeDefined();
      expect(new Date(logged.timestamp).toISOString()).toBe(logged.timestamp);
    });

    it('should always include service field', () => {
      logger.logConnectionAttempt(1);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.service).toBe('websocket');
    });

    it('should output valid JSON', () => {
      logger.logConnectionAttempt(1);

      const output = consoleSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe('without initial context', () => {
    it('should work without userId and socketId', () => {
      const noContextLogger = new WebSocketLogger();
      noContextLogger.logConnectionAttempt(1);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.userId).toBeUndefined();
      expect(logged.socketId).toBeUndefined();
    });
  });
});
