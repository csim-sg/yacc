/**
 * Metrics Sink Interface
 *
 * Abstract interface for emitting observability metrics.
 * Implementations can log to console, send to external services, etc.
 *
 * @module @yacc/frontend/services/observability
 */

/** Tags for metrics */
export type MetricsSinkTags = Record<string, string | number | boolean>;

/**
 * Metrics Sink Interface
 *
 * Provides a standard interface for emitting:
 * - Counters: Increment-only values (e.g., connection attempts)
 * - Histograms: Distribution of values (e.g., latency)
 * - Gauges: Point-in-time values (e.g., queue size)
 * - Timers: Measure execution duration
 */
export interface MetricsSink {
  /**
   * Emit a counter metric
   *
   * @param name - Metric name (e.g., 'ws.connection.attempt')
   * @param value - Increment value (typically 1)
   * @param tags - Optional tags for filtering/grouping
   */
  counter(name: string, value: number, tags?: MetricsSinkTags): void;

  /**
   * Emit a histogram metric
   *
   * @param name - Metric name (e.g., 'ws.event.processed')
   * @param value - Value to record (e.g., latency in ms)
   * @param tags - Optional tags for filtering/grouping
   */
  histogram(name: string, value: number, tags?: MetricsSinkTags): void;

  /**
   * Emit a gauge metric
   *
   * @param name - Metric name (e.g., 'ws.backlog.size')
   * @param value - Current value
   * @param tags - Optional tags for filtering/grouping
   */
  gauge(name: string, value: number, tags?: MetricsSinkTags): void;

  /**
   * Measure execution time of a function
   *
   * @param name - Metric name
   * @param fn - Function to measure
   * @param tags - Optional tags
   * @returns Return value of the function
   */
  timer<T>(name: string, fn: () => T, tags?: MetricsSinkTags): T;
}
