package com.yacc.common.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;

/**
 * MIG-021 schema/entity consistency gate: the JPA entity set covers the
 * Flyway schema exactly, table-for-table (AC-MIG-021-1).
 *
 * <p>Column-level fidelity is enforced continuously by Hibernate
 * {@code ddl-auto=validate} (application-test.yml): every context boot in the
 * test profile validates all entity mappings against the MIG-020
 * Flyway-built schema. This test adds the table-level 1:1 manifest check —
 * every mapped table exists and no table lacks an entity (the only
 * entity-less table is Flyway's own history).</p>
 *
 * <p>MIG-051 added the {@code websocket_backlog} entity (the V2 table was
 * deliberately deferred to it by the #346 arbitration ruling R1), so the
 * manifest now covers the 19 V1 baseline tables plus the V2 backlog table.
 * MIG-063 added the Quartz JDBC job-store tables (Flyway V4, ADR-028):
 * scheduler-internal persistence with deliberately NO JPA entity/repository,
 * so the manifest lists them as a separate Quartz-managed set.</p>
 */
class SchemaEntityConsistencyIntegrationTest extends AbstractPostgresIntegrationTest {

    /**
     * The 20 entity-mapped tables: the 19 entities of the MIG-021 data layer
     * mapped 1:1 to the V1 baseline tables (tech-lead ruling R4 on #346:
     * exactly 19, no more, no fewer) plus the V2 {@code websocket_backlog}
     * table whose entity MIG-051 owns (the #346 ruling R1 deferral is
     * discharged), in package-by-feature order (ADR-030).
     */
    private static final List<String> MAPPED_TABLES = List.of(
            // auth
            "account",
            "password_reset_tokens",
            "session",
            "users",
            "verification",
            // audit
            "audit_logs",
            // conversation
            "conversation_tags",
            "conversations",
            // dlq
            "dead_letter_queue",
            // integration
            "integration_configs",
            "integration_connection_profiles",
            // message
            "attachments",
            "messages",
            "raw_payloads",
            // note
            "notes",
            // notification
            "notifications",
            // realtime (MIG-051; Flyway V2)
            "websocket_backlog",
            // routingrule
            "routing_rule_executions",
            "routing_rules",
            // tag
            "tags");

    /**
     * The 11 Quartz JDBC job-store tables (Flyway V4; MIG-063, ADR-028) —
     * scheduler-internal persistence, deliberately NOT entity-mapped (no
     * JPA entity/repository exists for them; the store is Quartz's own
     * JDBC delegation, never queried through JPA).
     */
    private static final List<String> QUARTZ_MANAGED_TABLES = List.of(
            "qrtz_blob_triggers",
            "qrtz_calendars",
            "qrtz_cron_triggers",
            "qrtz_fired_triggers",
            "qrtz_job_details",
            "qrtz_locks",
            "qrtz_paused_trigger_grps",
            "qrtz_scheduler_state",
            "qrtz_simple_triggers",
            "qrtz_simprop_triggers",
            "qrtz_triggers");

    private final JdbcTemplate jdbcTemplate;

    /**
     * Constructor injection only (ARCH-004 §2 / ADR-024 / ADR-030) — also
     * applies to Spring context tests: {@code SpringExtension} autowires the
     * parameters of this single {@code @Autowired} constructor.
     */
    @Autowired
    SchemaEntityConsistencyIntegrationTest(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Test
    void mapsExactlyTwentyTables() {
        assertThat(MAPPED_TABLES).hasSize(20);
    }

    @Test
    void quartzJobStoreIsExactlyTheElevenSchedulerManagedTables() {
        assertThat(QUARTZ_MANAGED_TABLES).hasSize(11);
    }

    @Test
    void everyMappedTableExistsInTheSchema() {
        List<String> missing = new ArrayList<>();
        for (String table : MAPPED_TABLES) {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM information_schema.tables"
                            + " WHERE table_schema = 'public' AND table_name = ?",
                    Integer.class, table);
            if (count == null || count != 1) {
                missing.add(table);
            }
        }
        assertThat(missing).as("mapped tables missing from the schema").isEmpty();
    }

    @Test
    void schemaContainsExactlyTheMappedAndQuartzManagedTablesPlusFlywayHistory() {
        List<String> tables = jdbcTemplate.queryForList(
                "SELECT table_name FROM information_schema.tables"
                        + " WHERE table_schema = 'public' ORDER BY table_name",
                String.class);

        List<String> expected = new ArrayList<>(MAPPED_TABLES);
        expected.addAll(QUARTZ_MANAGED_TABLES);
        expected.add("flyway_schema_history");
        assertThat(tables).containsExactlyInAnyOrderElementsOf(expected);
    }
}
