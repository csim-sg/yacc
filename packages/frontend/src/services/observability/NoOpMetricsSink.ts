/**
 * No-Op Metrics Sink
 *
 * A no-op implementation that discards all metrics.
 * Useful for testing and environments where metrics should be disabled.
 *
 * @module @yacc/frontend/services/observability
 */

import type { MetricsSink, MetricsSinkTags } from './MetricsSink';

/**
 * No-Op Metrics Sink
 *
 * Silently discards all metrics. Use this in:
 * - Unit tests where metrics should not pollute output
 * - Production environments with metrics disabled
 * - Performance-sensitive code paths where metrics overhead matters
 */
export class NoOpMetricsSink implements MetricsSink {
  /**
   * No-op counter - does nothing
   */
  counter(): void {
    // Intentionally empty
  }

  /**
   * No-op histogram - does nothing
   */
  histogram(): void {
    // Intentionally empty
  }

  /**
   * No-op gauge - does nothing
   */
  gauge(): void {
    // Intentionally empty
  }

  /**
   * No-op timer - executes function without measuring
   *
   * @param _name - Metric name (ignored)
   * @param fn - Function to execute
   * @returns Return value of the function
   */
  timer<T>(_name: string, fn: () => T, _tags?: MetricsSinkTags): T {
    return fn();
  }
}

/**
 * Default no-op sink instance
 */
export const noOpMetricsSink = new NoOpMetricsSink();
