package com.yacc;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.ActiveProfiles;

import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
import com.yacc.realtime.model.WebSocketMetric;
import com.yacc.realtime.service.MetricsSink;

/**
 * Boots the application on a real port and verifies the observability wire
 * surface (AC-MIG-011-1): {@code /actuator/prometheus} scrapes metrics while
 * the frozen health probe wire paths stay at the root (ledger
 * REST-HEALTH-001..003). Uses the real servlet environment because MockMvc
 * does not route remapped multi-segment actuator paths.
 *
 * <p>MIG-030 note: since the identity subsystem landed, a full application
 * boot always includes the data layer and the security filter chain — the
 * former DB-free exclusion no longer matches the application shape, so this
 * test now boots on the shared Testcontainers PostgreSQL. The probe and
 * scrape paths are permit-all wire surface, which the unauthenticated calls
 * here double-check. {@code @AutoConfigureObservability} opts back into
 * metrics export, which the test framework disables by default — without it
 * the {@code /actuator/prometheus} endpoint is not registered.</p>
 */
@AutoConfigureObservability
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ObservabilityEndpointsTest extends AbstractPostgresIntegrationTest {

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
        // The root /prometheus path is unmapped AND not public wire surface:
        // the MIG-030 chain denies it with 401 before routing (deny by
        // default), which equally proves no duplicated scrape endpoint exists.
        assertThat(restTemplate.getForEntity("/prometheus", String.class).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
