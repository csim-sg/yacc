/**
 * Tests for ConsoleMetricsSink
 *
 * @module @yacc/frontend/services/observability/__tests__
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleMetricsSink, defaultMetricsSink } from '../ConsoleMetricsSink';

describe('ConsoleMetricsSink', () => {
  let sink: ConsoleMetricsSink;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sink = new ConsoleMetricsSink();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('counter', () => {
    it('should emit counter metrics', () => {
      sink.counter('ws.connection.attempt', 1);

      expect(consoleSpy).toHaveBeenCalled();
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.type).toBe('counter');
      expect(logged.metric).toBe('ws.connection.attempt');
      expect(logged.value).toBe(1);
    });

    it('should include tags when provided', () => {
      sink.counter('ws.connection.attempt', 1, { attempt_number: 2 });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.tags).toEqual({ attempt_number: 2 });
    });

    it('should omit tags when not provided', () => {
      sink.counter('ws.connection.attempt', 1);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.tags).toBeUndefined();
    });
  });

  describe('histogram', () => {
    it('should emit histogram metrics', () => {
      sink.histogram('ws.event.processed', 42.5);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.type).toBe('histogram');
      expect(logged.metric).toBe('ws.event.processed');
      expect(logged.value).toBe(42.5);
    });

    it('should include tags in histogram', () => {
      sink.histogram('ws.event.processed', 10, { event_type: 'message' });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.tags.event_type).toBe('message');
    });
  });

  describe('gauge', () => {
    it('should emit gauge metrics', () => {
      sink.gauge('ws.backlog.size', 5);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.type).toBe('gauge');
      expect(logged.metric).toBe('ws.backlog.size');
      expect(logged.value).toBe(5);
    });
  });

  describe('timer', () => {
    it('should measure timer duration', () => {
      const result = sink.timer('operation.timing', () => {
        return 'test-result';
      });

      expect(result).toBe('test-result');
      expect(consoleSpy).toHaveBeenCalled();

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.type).toBe('histogram');
      expect(logged.metric).toBe('operation.timing');
      expect(logged.value).toBeGreaterThanOrEqual(0);
    });

    it('should measure timer duration even on error', () => {
      expect(() =>
        sink.timer('operation.timing', () => {
          throw new Error('Test error');
        })
      ).toThrow('Test error');

      // Still should have logged the timing
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should include tags in timer', () => {
      sink.timer('operation.timing', () => 'result', { operation: 'test' });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.tags.operation).toBe('test');
    });
  });

  describe('output format', () => {
    it('should output valid JSON', () => {
      sink.counter('test.metric', 1, { tag: 'value' });

      const output = consoleSpy.mock.calls[0][0];
      expect(() => JSON.parse(output)).not.toThrow();
    });

    it('should include timestamp in ISO format', () => {
      sink.counter('test.metric', 1);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.timestamp).toBeDefined();
      expect(new Date(logged.timestamp).toISOString()).toBe(logged.timestamp);
    });

    it('should include type, metric, and value', () => {
      sink.counter('test.metric', 1);

      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.type).toBe('counter');
      expect(logged.metric).toBe('test.metric');
      expect(logged.value).toBe(1);
    });
  });

  describe('defaultMetricsSink', () => {
    it('should be a ConsoleMetricsSink instance', () => {
      expect(defaultMetricsSink).toBeInstanceOf(ConsoleMetricsSink);
    });
  });

  describe('all 8 WebSocket metrics', () => {
    it('should emit ws.connection.attempt', () => {
      sink.counter('ws.connection.attempt', 1, { attempt_number: 1 });
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.metric).toBe('ws.connection.attempt');
    });

    it('should emit ws.connection.success', () => {
      sink.counter('ws.connection.success', 1, { duration_ms: 100 });
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.metric).toBe('ws.connection.success');
    });

    it('should emit ws.connection.failure', () => {
      sink.counter('ws.connection.failure', 1, { error_type: 'Error' });
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.metric).toBe('ws.connection.failure');
    });

    it('should emit ws.reconnection.attempt', () => {
      sink.counter('ws.reconnection.attempt', 1, { attempt_number: 1 });
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.metric).toBe('ws.reconnection.attempt');
    });

    it('should emit ws.event.received', () => {
      sink.counter('ws.event.received', 1, { event_type: 'message' });
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.metric).toBe('ws.event.received');
    });

    it('should emit ws.event.processed', () => {
      sink.histogram('ws.event.processed', 10, { event_type: 'message' });
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.metric).toBe('ws.event.processed');
    });

    it('should emit ws.event.error', () => {
      sink.counter('ws.event.error', 1, { event_type: 'message' });
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.metric).toBe('ws.event.error');
    });

    it('should emit ws.backlog.replay', () => {
      sink.counter('ws.backlog.replay', 1, { backlog_size: 10 });
      const logged = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(logged.metric).toBe('ws.backlog.replay');
    });
  });
});
