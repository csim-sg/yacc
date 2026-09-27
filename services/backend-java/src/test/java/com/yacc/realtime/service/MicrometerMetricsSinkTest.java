package com.yacc.realtime.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;

/**
 * Tests for the Micrometer translation of {@link MetricsSink} (counter,
 * histogram, gauge, timer — POC MetricsSink parity).
 */
class MicrometerMetricsSinkTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final MicrometerMetricsSink sink = new MicrometerMetricsSink(registry);

    @Test
    void counterIncrementsMeterWithTag() {
        sink.counter("ws.connection.attempt", 1, Map.of("attempt_number", "1"));
        sink.counter("ws.connection.attempt", 1, Map.of("attempt_number", "1"));

        double count = registry.get("ws.connection.attempt").tag("attempt_number", "1").counter().count();
        assertThat(count).isEqualTo(2.0);
    }

    @Test
    void histogramRecordsValue() {
        sink.histogram("ws.event.processed", 42.5, Map.of("event_type", "message.new"));

        double sum = registry.get("ws.event.processed").tag("event_type", "message.new").summary().totalAmount();
        assertThat(sum).isEqualTo(42.5);
    }

    @Test
    void gaugeSetsAndUpdatesPointInTimeValue() {
        sink.gauge("ws.backlog.size", 5, Map.of());
        sink.gauge("ws.backlog.size", 7, Map.of());

        double value = registry.get("ws.backlog.size").gauge().value();
        assertThat(value).isEqualTo(7.0);
    }

    @Test
    void timerMeasuresAndForwardsToHistogram() {
        String result = sink.timer("ws.event.processed", () -> "done", Map.of("event_type", "message.new"));

        assertThat(result).isEqualTo("done");
        double count = registry.get("ws.event.processed").tag("event_type", "message.new").summary().count();
        assertThat(count).isEqualTo(1.0);
    }
}
