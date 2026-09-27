package com.yacc.realtime.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;

/**
 * Guards the frozen 8-metric contract (GOV-030 §4): exactly these names, no
 * additions, no renames — the MIG-011 guardrail forbids metric sprawl.
 */
class WebSocketMetricTest {

    private static final List<String> GOV_030_METRIC_NAMES = List.of(
            "ws.connection.attempt",
            "ws.connection.success",
            "ws.connection.failure",
            "ws.reconnection.attempt",
            "ws.event.received",
            "ws.event.processed",
            "ws.event.error",
            "ws.backlog.replay");

    @Test
    void containsExactlyTheEightFrozenMetrics() {
        Set<String> names = Arrays.stream(WebSocketMetric.values())
                .map(WebSocketMetric::getName)
                .collect(Collectors.toSet());

        assertThat(names).containsExactlyInAnyOrderElementsOf(GOV_030_METRIC_NAMES);
        assertThat(WebSocketMetric.values()).hasSize(8);
    }

    @Test
    void everyMetricCarriesATypeAndDescription() {
        for (WebSocketMetric metric : WebSocketMetric.values()) {
            assertThat(metric.getType()).isNotNull();
            assertThat(metric.getDescription()).isNotBlank();
        }
    }
}
