package com.yacc.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;

/**
 * MIG-102 (AC-MIG-102-4; SPEC-002 AC-02 evidence validity): proves the
 * production Spring context itself carries the corrected wire posture and
 * time basis — not just the builder-level posture exercised by the plain
 * contract tests. This is the drift guard: if a future change re-introduces a
 * test-only mapper or drops {@link JacksonConfig}/{@link UtcTimeBasisConfig}
 * from the context, these assertions fail against the real beans.
 *
 * <p>Runs on the shared PostgreSQL container harness (the pinned UTC basis is
 * the production posture; the test JVM default zone is pinned in
 * {@code build.gradle.kts}).</p>
 */
class ProductionSerializationIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private ObjectMapper productionObjectMapper;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void productionObjectMapperBeanEmitsRfc3339Utc() throws Exception {
        assertThat(productionObjectMapper
                .writeValueAsString(LocalDateTime.parse("2026-10-16T08:00:00")))
                .as("the auto-configured ObjectMapper bean stamps the UTC offset")
                .isEqualTo("\"2026-10-16T08:00:00Z\"");
    }

    @Test
    void productionObjectMapperBeanEmitsInstantAsRfc3339Utc() throws Exception {
        assertThat(productionObjectMapper.writeValueAsString(
                Instant.parse("2026-10-16T08:00:00Z")))
                .as("the auto-configured ObjectMapper bean emits the WS envelope "
                        + "timestamp type as RFC 3339 UTC (no decimal timestamps)")
                .isEqualTo("\"2026-10-16T08:00:00Z\"");
    }

    @Test
    void jvmDefaultZoneIsUtcInApplicationRuntime() {
        assertThat(ZoneId.systemDefault().normalized())
                .as("the application JVM runs on the pinned UTC basis")
                .isEqualTo(ZoneOffset.UTC);
    }

    @Test
    void jdbcSessionTimeZoneIsPinnedToUtc() {
        assertThat(jdbc.queryForObject("SELECT current_setting('TimeZone')", String.class))
                .as("the JDBC session zone pin (options=-c timezone=UTC) is active")
                .isEqualTo("UTC");
    }

    @Test
    void localDateTimeBindsLiterallyWithoutSessionConversion() {
        LocalDateTime value = LocalDateTime.parse("2026-10-16T08:00:00");

        assertThat(jdbc.queryForObject("SELECT ?::timestamp::text", String.class, value))
                .as("a `timestamp` (without zone) binding passes the UTC wall-clock "
                        + "literal through unchanged — no session-zone conversion")
                .isEqualTo("2026-10-16 08:00:00");
    }
}
