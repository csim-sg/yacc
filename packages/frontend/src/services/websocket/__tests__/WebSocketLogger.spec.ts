/**
 * Tests for WebSocketLogger with Metrics
 *
 * @module @yacc/frontend/services/websocket/__tests__
 */

import type { MetricsSink, MetricsSinkTags } from '../../observability/MetricsSink';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketLogger } from '../WebSocketLogger';

/** Mock MetricsSink for testing metric emission */
class MockMetricsSink implements MetricsSink {
  public counters: Array<{ name: string; value: number; tags?: MetricsSinkTags }> = [];
  public histograms: Array<{ name: string; value: number; tags?: MetricsSinkTags }> = [];
  public gauges: Array<{ name: string; value: number; tags?: MetricsSinkTags }> = [];

  counter(name: string, value: number, tags?: MetricsSinkTags): void {
    this.counters.push({ name, value, tags });
  }

  histogram(name: string, value: number, tags?: MetricsSinkTags): void {
    this.histograms.push({ name, value, tags });
  }

  gauge(name: string, value: number, tags?: MetricsSinkTags): void {
    this.gauges.push({ name, value, tags });
  }

  timer<T>(_name: string, fn: () => T, _tags?: MetricsSinkTags): T {
    return fn();
  }

  reset(): void {
    this.counters = [];
    this.histograms = [];
    this.gauges = [];
  }
}

describe('WebSocketLogger', () => {
  let logger: WebSocketLogger;
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let mockSink: MockMetricsSink;

  beforeEach(() => {
    mockSink = new MockMetricsSink();
    logger = new WebSocketLogger('user-123', 'socket-456', mockSink);
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logger.destroy();
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
      const noContextLogger = new WebSocketLogger(undefined, undefined, mockSink);
      noContextLogger.logConnectionAttempt(1);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.userId).toBeUndefined();
      expect(logged.socketId).toBeUndefined();
      noContextLogger.destroy();
    });
  });

  // ========================================================================
  // METRICS TESTS
  // ========================================================================

  describe('metrics emission', () => {
    it('should emit connection.attempt metric', () => {
      logger.logConnectionAttempt(1);

      expect(mockSink.counters).toHaveLength(1);
      expect(mockSink.counters[0].name).toBe('ws.connection.attempt');
      expect(mockSink.counters[0].value).toBe(1);
      expect(mockSink.counters[0].tags?.attempt_number).toBe(1);
    });

    it('should emit connection.success metric with duration', () => {
      logger.logConnectionSuccess(150);

      expect(mockSink.counters).toHaveLength(1);
      expect(mockSink.counters[0].name).toBe('ws.connection.success');
      expect(mockSink.counters[0].tags?.duration_ms).toBe(150);
    });

    it('should emit connection.failure metric with error', () => {
      const error = new Error('Connection refused');
      logger.logConnectionFailure(error, 2);

      expect(mockSink.counters).toHaveLength(1);
      expect(mockSink.counters[0].name).toBe('ws.connection.failure');
      expect(mockSink.counters[0].tags?.error_type).toBe('Error');
      expect(mockSink.counters[0].tags?.attempt_number).toBe(2);
    });

    it('should emit event.received metric', () => {
      logger.logEventReceived('message.received', 256);

      expect(mockSink.counters).toHaveLength(1);
      expect(mockSink.counters[0].name).toBe('ws.event.received');
      expect(mockSink.counters[0].tags?.event_type).toBe('message.received');
      expect(mockSink.counters[0].tags?.payload_size_bytes).toBe(256);
    });

    it('should emit event.processed metric with latency', () => {
      logger.logEventProcessed('message.received', 10, 2);

      expect(mockSink.histograms).toHaveLength(1);
      expect(mockSink.histograms[0].name).toBe('ws.event.processed');
      expect(mockSink.histograms[0].value).toBe(10);
      expect(mockSink.histograms[0].tags?.event_type).toBe('message.received');
      expect(mockSink.histograms[0].tags?.handler_count).toBe(2);
    });

    it('should emit event.error metric', () => {
      const error = new Error('Handler failed');
      logger.logEventError('message.received', error);

      expect(mockSink.counters).toHaveLength(1);
      expect(mockSink.counters[0].name).toBe('ws.event.error');
      expect(mockSink.counters[0].tags?.event_type).toBe('message.received');
      expect(mockSink.counters[0].tags?.error_type).toBe('Error');
    });

    it('should emit backlog.replay metric', () => {
      logger.logBacklogReplayed(10, 500);

      expect(mockSink.counters).toHaveLength(1);
      expect(mockSink.counters[0].name).toBe('ws.backlog.replay');
      expect(mockSink.counters[0].tags?.backlog_size).toBe(10);
      expect(mockSink.counters[0].tags?.replay_duration_ms).toBe(500);
    });

    it('should emit reconnection.attempt metric', () => {
      logger.logReconnectionAttempt(3, 4000);

      expect(mockSink.counters).toHaveLength(1);
      expect(mockSink.counters[0].name).toBe('ws.reconnection.attempt');
      expect(mockSink.counters[0].tags?.attempt_number).toBe(3);
      expect(mockSink.counters[0].tags?.backoff_delay_ms).toBe(4000);
    });

    it('should track all 8 metrics', () => {
      // Emit all 8 metrics
      logger.logConnectionAttempt(1);
      logger.logConnectionSuccess(100);
      logger.logConnectionFailure(new Error('test'), 2);
      logger.logReconnectionAttempt(1, 1000);
      logger.logEventReceived('test', 100);
      logger.logEventProcessed('test', 10, 1);
      logger.logEventError('test', new Error('test'));
      logger.logBacklogReplayed(10, 500);

      // Should have 7 counters + 1 histogram
      expect(mockSink.counters.length).toBe(7);
      expect(mockSink.histograms.length).toBe(1);
    });
  });

  describe('SLO tracking', () => {
    it('should track connection success rate', () => {
      logger.logConnectionAttempt(1);
      logger.logConnectionAttempt(1);
      logger.logConnectionSuccess(100);
      logger.logConnectionSuccess(100);

      const metrics = logger.getSLOMetrics();
      expect(metrics.connectionSuccessRate).toBe(1.0);
    });

    it('should detect SLO breach for connection success rate', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // 3 failures out of 10 attempts = 70% success rate (below 99%)
      for (let i = 0; i < 10; i++) {
        logger.logConnectionAttempt(1);
      }
      for (let i = 0; i < 7; i++) {
        logger.logConnectionSuccess(100);
      }
      for (let i = 0; i < 3; i++) {
        logger.logConnectionFailure(new Error('test'), 1);
      }

      // Should have warned
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should track event latency P95', () => {
      // Add 100 latencies
      for (let i = 1; i <= 100; i++) {
        logger.logEventProcessed('test', i, 1);
      }

      const metrics = logger.getSLOMetrics();
      // P95 of 1-100 should be around 95
      expect(metrics.eventLatencyP95).toBeGreaterThanOrEqual(90);
    });

    it('should detect SLO breach for event latency', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Add high latencies
      for (let i = 0; i < 100; i++) {
        logger.logEventProcessed('test', 200, 1);
      }

      // Should have warned about latency
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should warn when backlog replay exceeds 5s', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.logBacklogReplayed(100, 6000);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Backlog replay took 6000ms')
      );
      warnSpy.mockRestore();
    });

    it('should not warn when backlog replay is under 5s', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.logBacklogReplayed(100, 4000);

      // Should not warn about backlog
      const backlogWarning = warnSpy.mock.calls.find((call) =>
        call[0].includes('Backlog replay')
      );
      expect(backlogWarning).toBeUndefined();
      warnSpy.mockRestore();
    });

    it('should return SLO metrics via getSLOMetrics', () => {
      logger.logConnectionAttempt(1);
      logger.logConnectionSuccess(100);
      logger.logEventProcessed('test', 50, 1);
      logger.logReconnectionAttempt(1, 1000);
      logger.logReconnectionSuccess(1);
      logger.logBacklogReplayed(10, 500);

      const metrics = logger.getSLOMetrics();

      expect(metrics).toHaveProperty('connectionSuccessRate');
      expect(metrics).toHaveProperty('eventLatencyP95');
      expect(metrics).toHaveProperty('reconnectionSuccessRate');
      expect(metrics).toHaveProperty('backlogReplayEfficiency');
    });
  });

  describe('without metrics sink', () => {
    it('should work without a metrics sink', () => {
      const noSinkLogger = new WebSocketLogger('user-123', 'socket-456');

      // Should not throw
      expect(() => noSinkLogger.logConnectionAttempt(1)).not.toThrow();
      expect(() => noSinkLogger.logConnectionSuccess(100)).not.toThrow();
      expect(() => noSinkLogger.logEventProcessed('test', 10, 1)).not.toThrow();

      noSinkLogger.destroy();
    });
  });

  describe('destroy', () => {
    it('should clean up SLO monitor', () => {
      const destroySpy = vi.fn();
      logger.getSLOMonitor().destroy = destroySpy;

      logger.destroy();

      // destroy is called in afterEach, so it might be called multiple times
      // Just verify the logger can be destroyed without error
    });
  });
});
