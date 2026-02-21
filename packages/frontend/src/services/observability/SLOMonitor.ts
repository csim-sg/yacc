/**
 * SLO Monitor
 *
 * Tracks and calculates SLO (Service Level Objective) metrics for WebSocket connections.
 *
 * SLO Targets (from GOV-006):
 * - Connection Success Rate: ≥ 99.5%
 * - Event Delivery Latency P95: < 100ms
 * - Reconnection Success Rate: ≥ 95%
 * - Backlog Replay Efficiency: < 5s for 100 events
 *
 * @module @yacc/frontend/services/observability
 */

/** Current SLO metrics snapshot */
export interface SLOMetrics {
  /** Connection success rate (0-1, where 1 = 100%) */
  connectionSuccessRate: number;
  /** Event latency at 95th percentile (ms) */
  eventLatencyP95: number;
  /** Reconnection success rate (0-1, where 1 = 100%) */
  reconnectionSuccessRate: number;
  /** Backlog replay efficiency (0-1, where 1 = excellent) */
  backlogReplayEfficiency: number;
}

/** Backlog replay sample */
type BacklogSample = {
  size: number;
  duration: number;
};

/**
 * SLO Monitor
 *
 * Collects metrics and calculates SLO compliance.
 * Metrics are reset every 24 hours to prevent unbounded memory growth.
 */
export class SLOMonitor {
  // ========================================================================
  // Connection Metrics
  // ========================================================================
  private connectionAttempts = 0;
  private connectionSuccesses = 0;
  private connectionFailures = 0;

  // ========================================================================
  // Reconnection Metrics
  // ========================================================================
  private reconnectionAttempts = 0;
  private reconnectionSuccesses = 0;

  // ========================================================================
  // Event Latency Metrics
  // ========================================================================
  private eventLatencies: number[] = [];
  private readonly maxLatencySamples = 1000;

  // ========================================================================
  // Backlog Replay Metrics
  // ========================================================================
  private backlogReplays: BacklogSample[] = [];
  private readonly maxBacklogSamples = 100;

  // ========================================================================
  // Reset Timer
  // ========================================================================
  private resetTimer: ReturnType<typeof setInterval> | null = null;
  private readonly resetIntervalMs = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Create a new SLO monitor
   *
   * Automatically starts the 24-hour reset timer.
   */
  constructor() {
    this.startResetTimer();
  }

  // ========================================================================
  // Connection Tracking
  // ========================================================================

  /**
   * Record a connection attempt
   */
  recordConnectionAttempt(): void {
    this.connectionAttempts++;
  }

  /**
   * Record a successful connection
   */
  recordConnectionSuccess(): void {
    this.connectionSuccesses++;
  }

  /**
   * Record a failed connection
   */
  recordConnectionFailure(): void {
    this.connectionFailures++;
  }

  // ========================================================================
  // Reconnection Tracking
  // ========================================================================

  /**
   * Record a reconnection attempt
   */
  recordReconnectionAttempt(): void {
    this.reconnectionAttempts++;
  }

  /**
   * Record a successful reconnection
   */
  recordReconnectionSuccess(): void {
    this.reconnectionSuccesses++;
  }

  // ========================================================================
  // Event Latency Tracking
  // ========================================================================

  /**
   * Record event processing latency
   *
   * @param latencyMs - Processing time in milliseconds
   */
  recordEventLatency(latencyMs: number): void {
    this.eventLatencies.push(latencyMs);

    // Keep array bounded
    if (this.eventLatencies.length > this.maxLatencySamples) {
      this.eventLatencies.shift();
    }
  }

  // ========================================================================
  // Backlog Replay Tracking
  // ========================================================================

  /**
   * Record a backlog replay event
   *
   * @param size - Number of events replayed
   * @param durationMs - Time taken to replay in milliseconds
   */
  recordBacklogReplay(size: number, durationMs: number): void {
    this.backlogReplays.push({ size, duration: durationMs });

    if (this.backlogReplays.length > this.maxBacklogSamples) {
      this.backlogReplays.shift();
    }
  }

  // ========================================================================
  // SLO Calculations
  // ========================================================================

  /**
   * Get current SLO metrics
   *
   * @returns Snapshot of all SLO metrics
   */
  getMetrics(): SLOMetrics {
    return {
      connectionSuccessRate: this.calculateConnectionSuccessRate(),
      eventLatencyP95: this.calculateEventLatencyP95(),
      reconnectionSuccessRate: this.calculateReconnectionSuccessRate(),
      backlogReplayEfficiency: this.calculateBacklogReplayEfficiency(),
    };
  }

  /**
   * Check if a metric is below SLO threshold
   *
   * @param metric - Metric name to check
   * @param threshold - Threshold value
   * @returns true if metric is below threshold (SLO breach)
   */
  isBelowSLO(metric: keyof SLOMetrics, threshold: number): boolean {
    const metrics = this.getMetrics();
    return metrics[metric] < threshold;
  }

  /**
   * Check if a metric is above SLO threshold
   *
   * @param metric - Metric name to check
   * @param threshold - Threshold value
   * @returns true if metric is above threshold (SLO breach)
   */
  isAboveSLO(metric: keyof SLOMetrics, threshold: number): boolean {
    const metrics = this.getMetrics();
    return metrics[metric] > threshold;
  }

  // ========================================================================
  // Private - SLO Calculations
  // ========================================================================

  /**
   * Calculate connection success rate
   *
   * @returns Rate between 0-1 (1 = 100% success)
   */
  private calculateConnectionSuccessRate(): number {
    if (this.connectionAttempts === 0) return 1.0;
    return this.connectionSuccesses / this.connectionAttempts;
  }

  /**
   * Calculate event latency at 95th percentile
   *
   * @returns Latency in milliseconds
   */
  private calculateEventLatencyP95(): number {
    if (this.eventLatencies.length === 0) return 0;

    const sorted = [...this.eventLatencies].sort((a, b) => a - b);
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    return sorted[p95Index] ?? 0;
  }

  /**
   * Calculate reconnection success rate
   *
   * @returns Rate between 0-1 (1 = 100% success)
   */
  private calculateReconnectionSuccessRate(): number {
    if (this.reconnectionAttempts === 0) return 1.0;
    return this.reconnectionSuccesses / this.reconnectionAttempts;
  }

  /**
   * Calculate backlog replay efficiency
   *
   * Efficiency is calculated as:
   * - Target: 50ms per event (5s for 100 events)
   * - Efficiency = max(0, 1 - (actual - expected) / expected)
   *
   * @returns Efficiency between 0-1 (1 = excellent)
   */
  private calculateBacklogReplayEfficiency(): number {
    if (this.backlogReplays.length === 0) return 1.0;

    let totalEfficiency = 0;

    for (const replay of this.backlogReplays) {
      // Target: 50ms per event
      const expectedDuration = replay.size * 50;
      const actualDuration = replay.duration;

      // Calculate efficiency: 1.0 = on target, >1 = better than expected
      let efficiency = 1.0;
      if (expectedDuration > 0) {
        efficiency = 1 - (actualDuration - expectedDuration) / expectedDuration;
      }
      totalEfficiency += Math.max(0, efficiency);
    }

    return totalEfficiency / this.backlogReplays.length;
  }

  // ========================================================================
  // Reset Logic
  // ========================================================================

  /**
   * Start the 24-hour reset timer
   */
  private startResetTimer(): void {
    this.resetTimer = setInterval(() => {
      this.reset();
    }, this.resetIntervalMs);
  }

  /**
   * Reset all metrics
   *
   * Called automatically every 24 hours.
   */
  reset(): void {
    this.connectionAttempts = 0;
    this.connectionSuccesses = 0;
    this.connectionFailures = 0;
    this.reconnectionAttempts = 0;
    this.reconnectionSuccesses = 0;
    this.eventLatencies = [];
    this.backlogReplays = [];
  }

  /**
   * Destroy the monitor and clean up resources
   */
  destroy(): void {
    if (this.resetTimer) {
      clearInterval(this.resetTimer);
      this.resetTimer = null;
    }
  }

  // ========================================================================
  // Debug/Testing Helpers
  // ========================================================================

  /**
   * Get raw counts (for testing/debugging)
   */
  getRawCounts(): {
    connectionAttempts: number;
    connectionSuccesses: number;
    connectionFailures: number;
    reconnectionAttempts: number;
    reconnectionSuccesses: number;
    eventLatencies: number;
    backlogReplays: number;
  } {
    return {
      connectionAttempts: this.connectionAttempts,
      connectionSuccesses: this.connectionSuccesses,
      connectionFailures: this.connectionFailures,
      reconnectionAttempts: this.reconnectionAttempts,
      reconnectionSuccesses: this.reconnectionSuccesses,
      eventLatencies: this.eventLatencies.length,
      backlogReplays: this.backlogReplays.length,
    };
  }
}
