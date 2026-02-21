/**
 * Tests for NoOpMetricsSink
 *
 * @module @yacc/frontend/services/observability/__tests__
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NoOpMetricsSink, noOpMetricsSink } from '../NoOpMetricsSink';

describe('NoOpMetricsSink', () => {
  let sink: NoOpMetricsSink;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sink = new NoOpMetricsSink();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('counter', () => {
    it('should not log anything', () => {
      // NoOpMetricsSink ignores all arguments
      (sink as unknown as { counter: (...args: unknown[]) => void }).counter('ws.connection.attempt', 1, { attempt_number: 1 });
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('histogram', () => {
    it('should not log anything', () => {
      (sink as unknown as { histogram: (...args: unknown[]) => void }).histogram('ws.event.processed', 50, { event_type: 'message' });
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('gauge', () => {
    it('should not log anything', () => {
      (sink as unknown as { gauge: (...args: unknown[]) => void }).gauge('ws.backlog.size', 5);
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('timer', () => {
    it('should execute function without logging', () => {
      const fn = vi.fn(() => 'test-result');
      const result = sink.timer('operation.timing', fn);

      expect(result).toBe('test-result');
      expect(fn).toHaveBeenCalled();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should propagate errors', () => {
      const error = new Error('Test error');
      expect(() => sink.timer('operation.timing', () => { throw error; })).toThrow('Test error');
    });
  });

  describe('noOpMetricsSink', () => {
    it('should be a NoOpMetricsSink instance', () => {
      expect(noOpMetricsSink).toBeInstanceOf(NoOpMetricsSink);
    });
  });
});
