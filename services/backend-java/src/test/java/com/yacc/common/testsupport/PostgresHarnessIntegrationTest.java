package com.yacc.common.testsupport;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Example test proving the MIG-014 harness (AC-MIG-014-1): a full Spring
 * context, wired to the real Testcontainers PostgreSQL container via
 * {@link AbstractPostgresIntegrationTest}, performs a data-layer round trip
 * through the managed {@link JdbcTemplate}.
 *
 * <p>This is the template future data-layer integration tests (MIG-020/021
 * onward) build on; it contains no business or migration logic.</p>
 */
class PostgresHarnessIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void executesSqlAgainstRealPostgreSQL() {
        Integer one = jdbcTemplate.queryForObject("SELECT 1", Integer.class);

        assertThat(one).isEqualTo(1);
    }

    @Test
    void connectsToTheContainerDatabase() {
        String database = jdbcTemplate.queryForObject("SELECT current_database()", String.class);

        assertThat(database).isEqualTo(POSTGRES.getDatabaseName());
    }
}
