/**
 * Console Metrics Sink
 *
 * Default implementation that logs metrics to console as JSON.
 * Useful for development and debugging.
 *
 * @module @yacc/frontend/services/observability
 */

import type { MetricsSink, MetricsSinkTags } from './MetricsSink';

/** Metric entry logged to console */
interface ConsoleMetricEntry {
  timestamp: string;
  type: 'counter' | 'histogram' | 'gauge' | 'timer';
  metric: string;
  value: number;
  tags?: MetricsSinkTags;
}

/**
 * Console Metrics Sink
 *
 * Logs all metrics to console as structured JSON.
 * This is the default sink for development environments.
 *
 * Example output:
 * {"timestamp":"2026-02-21T10:30:00.000Z","type":"counter","metric":"ws.connection.attempt","value":1,"tags":{"attempt_number":1}}
 */
export class ConsoleMetricsSink implements MetricsSink {
  /**
   * Emit a counter metric
   */
  counter(name: string, value: number, tags?: MetricsSinkTags): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'counter',
      metric: name,
      value,
      tags,
    });
  }

  /**
   * Emit a histogram metric
   */
  histogram(name: string, value: number, tags?: MetricsSinkTags): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'histogram',
      metric: name,
      value,
      tags,
    });
  }

  /**
   * Emit a gauge metric
   */
  gauge(name: string, value: number, tags?: MetricsSinkTags): void {
    this.log({
      timestamp: new Date().toISOString(),
      type: 'gauge',
      metric: name,
      value,
      tags,
    });
  }

  /**
   * Measure execution time of a function
   *
   * Uses performance.now() for high-precision timing.
   */
  timer<T>(name: string, fn: () => T, tags?: MetricsSinkTags): T {
    const startTime = performance.now();
    try {
      return fn();
    } finally {
      const duration = performance.now() - startTime;
      this.histogram(name, duration, tags);
    }
  }

  /**
   * Log metric entry to console
   */
  private log(entry: ConsoleMetricEntry): void {
    // Only log if tags exist, otherwise omit them
    const output = entry.tags
      ? entry
      : { timestamp: entry.timestamp, type: entry.type, metric: entry.metric, value: entry.value };

    console.log(JSON.stringify(output));
  }
}

/**
 * Default metrics sink instance
 *
 * Used when no custom sink is provided.
 */
export const defaultMetricsSink = new ConsoleMetricsSink();
