/**
 * Tests for SLOMonitor
 *
 * @module @yacc/frontend/services/observability/__tests__
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SLOMonitor } from '../SLOMonitor';

describe('SLOMonitor', () => {
  let monitor: SLOMonitor;

  beforeEach(() => {
    monitor = new SLOMonitor();
  });

  afterEach(() => {
    monitor.destroy();
  });

  describe('connection success rate', () => {
    it('should return 1.0 when no attempts recorded', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.connectionSuccessRate).toBe(1.0);
    });

    it('should calculate connection success rate correctly', () => {
      // 8 successes out of 10 attempts = 0.8
      monitor.recordConnectionAttempt();
      monitor.recordConnectionAttempt();
      monitor.recordConnectionAttempt();
      monitor.recordConnectionAttempt();
      monitor.recordConnectionAttempt();
      monitor.recordConnectionAttempt();
      monitor.recordConnectionAttempt();
      monitor.recordConnectionAttempt();
      monitor.recordConnectionAttempt();
      monitor.recordConnectionAttempt();

      monitor.recordConnectionSuccess();
      monitor.recordConnectionSuccess();
      monitor.recordConnectionSuccess();
      monitor.recordConnectionSuccess();
      monitor.recordConnectionSuccess();
      monitor.recordConnectionSuccess();
      monitor.recordConnectionSuccess();
      monitor.recordConnectionSuccess();

      // 8/10 = 0.8
      const metrics = monitor.getMetrics();
      expect(metrics.connectionSuccessRate).toBe(0.8);
    });

    it('should return 1.0 for 100% success rate', () => {
      monitor.recordConnectionAttempt();
      monitor.recordConnectionSuccess();

      const metrics = monitor.getMetrics();
      expect(metrics.connectionSuccessRate).toBe(1.0);
    });

    it('should track failures separately', () => {
      monitor.recordConnectionAttempt();
      monitor.recordConnectionFailure();

      const metrics = monitor.getMetrics();
      expect(metrics.connectionSuccessRate).toBe(0.0);
    });
  });

  describe('event latency P95', () => {
    it('should return 0 when no latencies recorded', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.eventLatencyP95).toBe(0);
    });

    it('should calculate P95 correctly with 100 samples', () => {
      // Add 100 samples: 1-100ms
      for (let i = 1; i <= 100; i++) {
        monitor.recordEventLatency(i);
      }

      const metrics = monitor.getMetrics();
      // P95 of 1-100 is around 95
      expect(metrics.eventLatencyP95).toBeGreaterThanOrEqual(94);
      expect(metrics.eventLatencyP95).toBeLessThanOrEqual(96);
    });

    it('should calculate P95 correctly with small sample', () => {
      // Add 10 samples: 10, 20, 30, ..., 100
      for (let i = 10; i <= 100; i += 10) {
        monitor.recordEventLatency(i);
      }

      const metrics = monitor.getMetrics();
      // P95 of 10 samples should be around 90-100
      expect(metrics.eventLatencyP95).toBeGreaterThanOrEqual(90);
    });

    it('should keep bounded sample size', () => {
      // Add more than max samples
      for (let i = 1; i <= 1500; i++) {
        monitor.recordEventLatency(i);
      }

      const rawCounts = monitor.getRawCounts();
      expect(rawCounts.eventLatencies).toBeLessThanOrEqual(1000);
    });
  });

  describe('reconnection success rate', () => {
    it('should return 1.0 when no attempts recorded', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.reconnectionSuccessRate).toBe(1.0);
    });

    it('should calculate reconnection success rate correctly', () => {
      // 19 successes out of 20 attempts = 0.95
      for (let i = 0; i < 20; i++) {
        monitor.recordReconnectionAttempt();
      }
      for (let i = 0; i < 19; i++) {
        monitor.recordReconnectionSuccess();
      }

      const metrics = monitor.getMetrics();
      expect(metrics.reconnectionSuccessRate).toBe(0.95);
    });

    it('should return 0 for 0% success rate', () => {
      monitor.recordReconnectionAttempt();
      // No success recorded

      const metrics = monitor.getMetrics();
      expect(metrics.reconnectionSuccessRate).toBe(0.0);
    });
  });

  describe('backlog replay efficiency', () => {
    it('should return 1.0 when no replays recorded', () => {
      const metrics = monitor.getMetrics();
      expect(metrics.backlogReplayEfficiency).toBe(1.0);
    });

    it('should calculate efficiency for on-target replay', () => {
      // 100 events at 50ms/event = 5000ms expected, actual 5000ms
      // Efficiency should be 1.0
      monitor.recordBacklogReplay(100, 5000);

      const metrics = monitor.getMetrics();
      expect(metrics.backlogReplayEfficiency).toBe(1.0);
    });

    it('should calculate efficiency for faster-than-target replay', () => {
      // 100 events at 50ms/event = 5000ms expected, actual 2500ms
      // Efficiency should be > 1.0
      monitor.recordBacklogReplay(100, 2500);

      const metrics = monitor.getMetrics();
      expect(metrics.backlogReplayEfficiency).toBeGreaterThan(1.0);
    });

    it('should calculate efficiency for slower-than-target replay', () => {
      // 100 events at 50ms/event = 5000ms expected, actual 10000ms
      // Efficiency should be 0 (or close to 0)
      monitor.recordBacklogReplay(100, 10000);

      const metrics = monitor.getMetrics();
      expect(metrics.backlogReplayEfficiency).toBe(0.0);
    });

    it('should keep bounded sample size', () => {
      // Add more than max samples
      for (let i = 0; i < 150; i++) {
        monitor.recordBacklogReplay(10, 500);
      }

      const rawCounts = monitor.getRawCounts();
      expect(rawCounts.backlogReplays).toBeLessThanOrEqual(100);
    });
  });

  describe('SLO threshold checks', () => {
    it('should detect below SLO threshold', () => {
      monitor.recordConnectionAttempt();
      monitor.recordConnectionFailure();

      const isBelow = monitor.isBelowSLO('connectionSuccessRate', 0.99);
      expect(isBelow).toBe(true);
    });

    it('should detect above SLO threshold', () => {
      // Add high latency
      for (let i = 0; i < 100; i++) {
        monitor.recordEventLatency(200);
      }

      const isAbove = monitor.isAboveSLO('eventLatencyP95', 100);
      expect(isAbove).toBe(true);
    });

    it('should not trigger false positives', () => {
      monitor.recordConnectionAttempt();
      monitor.recordConnectionSuccess();

      const isBelow = monitor.isBelowSLO('connectionSuccessRate', 0.99);
      expect(isBelow).toBe(false);
    });
  });

  describe('reset functionality', () => {
    it('should reset all metrics', () => {
      // Add some data
      monitor.recordConnectionAttempt();
      monitor.recordConnectionSuccess();
      monitor.recordEventLatency(50);
      monitor.recordBacklogReplay(10, 500);

      // Reset
      monitor.reset();

      const metrics = monitor.getMetrics();
      expect(metrics.connectionSuccessRate).toBe(1.0);
      expect(metrics.eventLatencyP95).toBe(0);
      expect(metrics.backlogReplayEfficiency).toBe(1.0);
    });
  });

  describe('destroy', () => {
    it('should clean up reset timer', () => {
      const destroySpy = vi.spyOn(global, 'clearInterval');
      monitor.destroy();
      expect(destroySpy).toHaveBeenCalled();
      destroySpy.mockRestore();
    });
  });

  describe('getRawCounts', () => {
    it('should return raw counts for debugging', () => {
      monitor.recordConnectionAttempt();
      monitor.recordConnectionSuccess();
      monitor.recordReconnectionAttempt();
      monitor.recordReconnectionSuccess();
      monitor.recordEventLatency(50);
      monitor.recordBacklogReplay(10, 500);

      const counts = monitor.getRawCounts();
      expect(counts.connectionAttempts).toBe(1);
      expect(counts.connectionSuccesses).toBe(1);
      expect(counts.reconnectionAttempts).toBe(1);
      expect(counts.reconnectionSuccesses).toBe(1);
      expect(counts.eventLatencies).toBe(1);
      expect(counts.backlogReplays).toBe(1);
    });
  });
});
