package com.yacc.realtime.model;

/**
 * The eight frozen WebSocket observability metrics (GOV-030 §4; SPEC-002
 * TR-07/AC-05; ADR-029 "MetricsSink (8 metrics) re-expressed").
 *
 * <p>This enum is the single authoritative re-expression of the POC metric
 * contract (GOV-030, wired via {@code packages/frontend/src/services/observability/
 * MetricsSink.ts}). No additional metric names may be introduced — the
 * tech-lead guardrail for MIG-011 explicitly forbids metric sprawl.</p>
 *
 * <p>Tag sets are the GOV-030 tags minus the {@code timestamp} tag: Prometheus
 * records scrape time natively, and a timestamp label would explode label
 * cardinality (GOV-030 §5 caps unique combinations at 1000).</p>
 */
public enum WebSocketMetric {

    CONNECTION_ATTEMPT(
            "ws.connection.attempt", MetricType.COUNTER,
            "Connection attempt started; tags: attempt_number."),
    CONNECTION_SUCCESS(
            "ws.connection.success", MetricType.COUNTER,
            "Connection established; tags: duration_ms."),
    CONNECTION_FAILURE(
            "ws.connection.failure", MetricType.COUNTER,
            "Connection failed; tags: error_type, error_message."),
    RECONNECTION_ATTEMPT(
            "ws.reconnection.attempt", MetricType.COUNTER,
            "Auto-reconnect triggered; tags: attempt_number, backoff_delay_ms."),
    EVENT_RECEIVED(
            "ws.event.received", MetricType.COUNTER,
            "WebSocket event received; tags: event_type, payload_size_bytes."),
    EVENT_PROCESSED(
            "ws.event.processed", MetricType.HISTOGRAM,
            "Received-to-handler-complete latency in milliseconds; tags: event_type, handler_count."),
    EVENT_ERROR(
            "ws.event.error", MetricType.COUNTER,
            "Event handler threw; tags: event_type, error_type, error_message."),
    BACKLOG_REPLAY(
            "ws.backlog.replay", MetricType.COUNTER,
            "Backlog replayed after reconnect; tags: backlog_size, replay_duration_ms.");

    /** Emission kind, mirroring the POC MetricsSink primitives. */
    public enum MetricType {
        COUNTER, HISTOGRAM, GAUGE, TIMER
    }

    private final String name;
    private final MetricType type;
    private final String description;

    WebSocketMetric(String name, MetricType type, String description) {
        this.name = name;
        this.type = type;
        this.description = description;
    }

    /** Metric name exactly as frozen in GOV-030 (Prometheus sanitizes dots). */
    public String getName() {
        return name;
    }

    public MetricType getType() {
        return type;
    }

    public String getDescription() {
        return description;
    }
}
