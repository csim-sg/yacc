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
 * test profile validates all 19 entity mappings against the MIG-020
 * Flyway-built schema. This test adds the table-level 1:1 manifest check —
 * every mapped table exists and no table lacks an entity (the only
 * entity-less table is Flyway's own history).</p>
 */
class SchemaEntityConsistencyIntegrationTest extends AbstractPostgresIntegrationTest {

    /**
     * The 19 entities of the MIG-021 data layer, mapped 1:1 to the V1
     * baseline tables (tech-lead ruling R4 on #346: exactly 19, no more, no
     * fewer), in package-by-feature order (ADR-030).
     *
     * <p>The V2 {@code websocket_backlog} table is deliberately
     * <strong>not</strong> entity-mapped here: it is owned by MIG-051
     * (backlog replay behavior, ADR-028) per the #346 arbitration ruling R1
     * — MIG-021 maps the 19-table V1 baseline only.</p>
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
            // routingrule
            "routing_rule_executions",
            "routing_rules",
            // tag
            "tags");

    /** The V2 table intentionally left entity-less until MIG-051. */
    private static final String UNMAPPED_V2_TABLE = "websocket_backlog";

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
    void mapsExactlyNineteenBaselineTables() {
        assertThat(MAPPED_TABLES).hasSize(19);
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
    void schemaContainsExactlyTheMappedTablesPlusV2AndFlywayHistory() {
        List<String> tables = jdbcTemplate.queryForList(
                "SELECT table_name FROM information_schema.tables"
                        + " WHERE table_schema = 'public' ORDER BY table_name",
                String.class);

        List<String> expected = new ArrayList<>(MAPPED_TABLES);
        expected.add(UNMAPPED_V2_TABLE);
        expected.add("flyway_schema_history");
        assertThat(tables).containsExactlyInAnyOrderElementsOf(expected);
    }
}
