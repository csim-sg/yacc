package com.yacc.realtime.service;

import java.util.Map;
import java.util.function.Supplier;

/**
 * Metrics sink (POC parity: {@code packages/frontend/src/services/observability/
 * MetricsSink.ts} — counter / histogram / gauge / timer primitives with tags).
 *
 * <p>Implementations translate emissions onto the runtime metrics backend; the
 * production backend is Micrometer with the {@code /actuator/prometheus} scrape
 * endpoint (SPEC-002 TR-07; ADR-029). Metric names and tag sets are governed by
 * {@link com.yacc.realtime.model.WebSocketMetric} — no new metrics without a
 * reviewed contract change (MIG-011 guardrail: no metric sprawl).</p>
 *
 * <p>Tags are string key/value pairs (Prometheus labels); the POC's
 * {@code timestamp} tag is never emitted server-side. Latency histograms are
 * recorded in milliseconds, matching the POC {@code durationMs} convention.</p>
 */
public interface MetricsSink {

    /**
     * Emit a counter increment (e.g. connection attempts).
     *
     * @param name metric name (GOV-030 frozen set)
     * @param value increment value (typically 1)
     * @param tags label set (non-null; may be empty)
     */
    void counter(String name, long value, Map<String, String> tags);

    /**
     * Record a value into a distribution histogram (e.g. event latency in ms).
     *
     * @param name metric name (GOV-030 frozen set)
     * @param value recorded value (milliseconds for latency histograms)
     * @param tags label set (non-null; may be empty)
     */
    void histogram(String name, double value, Map<String, String> tags);

    /**
     * Set the current value of a point-in-time gauge (e.g. backlog size).
     *
     * @param name metric name (GOV-030 frozen set)
     * @param value current value
     * @param tags label set (non-null; may be empty)
     */
    void gauge(String name, long value, Map<String, String> tags);

    /**
     * Measure execution of {@code fn} and forward the elapsed milliseconds to
     * {@link #histogram} (POC parity: {@code timer} delegates to
     * {@code histogram} with {@code durationMs}).
     *
     * @param name metric name (GOV-030 frozen set)
     * @param fn the function to measure
     * @param tags label set (non-null; may be empty)
     * @param <T> result type
     * @return the value returned by {@code fn}
     */
    <T> T timer(String name, Supplier<T> fn, Map<String, String> tags);
}
