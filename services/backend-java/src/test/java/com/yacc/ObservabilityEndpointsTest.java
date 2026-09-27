package com.yacc;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import com.yacc.realtime.model.WebSocketMetric;
import com.yacc.realtime.service.MetricsSink;

/**
 * Boots the application on a real port and verifies the observability wire
 * surface (AC-MIG-011-1): {@code /actuator/prometheus} scrapes metrics while
 * the frozen health probe wire paths stay at the root (ledger
 * REST-HEALTH-001..003). Uses the real servlet environment because MockMvc
 * does not route remapped multi-segment actuator paths.
 *
 * <p>{@code DataSourceAutoConfiguration} is excluded: MIG-014's JDBC test
 * harness activates it on the test classpath, but no database exists in
 * MIG-011 scope (the data stack lands in MIG-020/021). The
 * {@code UserDetailsServiceAutoConfiguration} exclusion mirrors
 * {@code application.yml} (MIG-030 owns identity). {@code @AutoConfigureObservability}
 * opts back into metrics export, which the test framework disables by default
 * — without it the {@code /actuator/prometheus} endpoint is not registered.</p>
 */
@AutoConfigureObservability
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "spring.autoconfigure.exclude="
                        + "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
                        + "org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration"
        })
@ActiveProfiles("test")
class ObservabilityEndpointsTest {

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private MetricsSink metricsSink;

    @Test
    void prometheusEndpointScrapesEmittedMetrics() {
        metricsSink.counter(WebSocketMetric.CONNECTION_SUCCESS.getName(), 1, Map.of("event_type", "boot-test"));

        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/prometheus", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("ws_connection_success_total");
    }

    @Test
    void frozenHealthWirePathsRemainAtRoot() {
        assertThat(restTemplate.getForEntity("/health", String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(restTemplate.getForEntity("/health/live", String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(restTemplate.getForEntity("/health/ready", String.class).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void prometheusPathIsNotDuplicatedAtRoot() {
        assertThat(restTemplate.getForEntity("/prometheus", String.class).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }
}
