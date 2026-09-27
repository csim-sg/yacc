package com.yacc;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
import com.yacc.conversation.model.ChannelType;
import com.yacc.conversation.model.ConversationPriority;
import com.yacc.conversation.model.ConversationStatus;
import com.yacc.message.model.MessageDirection;
import com.yacc.message.model.MessageStatus;
import com.yacc.user.model.UserRole;
import com.yacc.user.model.UserStatus;

/**
 * Verifies the Flyway V1 full-reset baseline against real PostgreSQL
 * (AC-MIG-020-1/2/3; SPEC-002 FR-03; ADR-027/028).
 *
 * <p>Booting this context auto-applies {@code db/migration/V1__baseline.sql}
 * through the {@link AbstractPostgresIntegrationTest} Testcontainers harness;
 * the assertions below re-derive the expected schema straight from the
 * catalog:</p>
 *
 * <ul>
 *   <li><strong>Monotonic sequence</strong> — exactly one applied migration,
 *       version 1 (the duplicate POC 0005/0006 numbering is resolved by not
 *       carrying it forward).</li>
 *   <li><strong>19 re-expressed tables + websocket_backlog</strong> — exact
 *       set equality on the public catalog (ADR-028 re-homes the WS backlog
 *       to PostgreSQL).</li>
 *   <li><strong>Enum mapping</strong> — every PG enum label set equals the
 *       owning Java enum's database values (ADR-030 model placement).</li>
 *   <li><strong>End-state spot checks</strong> — the late POC deltas
 *       (users.deleted_at, partial conversation uniqueness, the
 *       active-implies-enabled check) prove the final state was re-expressed,
 *       not the initial 0000 state.</li>
 * </ul>
 */
class FlywayV1BaselineMigrationIntegrationTest extends AbstractPostgresIntegrationTest {

    /** The 19 ledger-recorded POC tables + websocket_backlog (ADR-028). */
    private static final Set<String> EXPECTED_TABLES = Set.of(
            "users", "account", "session", "verification", "attachments",
            "audit_logs", "conversations", "conversation_tags",
            "dead_letter_queue", "integration_configs",
            "integration_connection_profiles", "messages", "notes",
            "notifications", "password_reset_tokens", "raw_payloads",
            "routing_rules", "routing_rule_executions", "tags",
            "websocket_backlog");

    /** PG enum type -> expected label set (V1 baseline). */
    private static final Map<String, Set<String>> EXPECTED_ENUM_LABELS = Map.of(
            "user_role", Set.of("super_admin", "admin", "manager", "user"),
            "user_status", Set.of("active", "inactive", "suspended"),
            "channel_type", Set.of("telegram", "irc", "whatsapp", "wechat", "meta", "x", "email", "slack"),
            "conversation_status", Set.of("open", "pending", "resolved"),
            "conversation_priority", Set.of("low", "normal", "high", "urgent"),
            "message_status", Set.of("pending", "sent", "failed"),
            "message_direction", Set.of("inbound", "outbound"));

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void appliesExactlyOneMonotonicBaselineMigration() {
        List<Map<String, Object>> history = jdbcTemplate.queryForList(
                "SELECT version, description, success FROM flyway_schema_history ORDER BY installed_rank");

        assertThat(history).hasSize(1);
        assertThat(history.get(0))
                .containsEntry("version", "1")
                .containsEntry("description", "baseline")
                .containsEntry("success", true);
    }

    @Test
    void reproducesAllNineteenPocTablesPlusWebsocketBacklog() {
        List<String> tables = jdbcTemplate.queryForList(
                "SELECT table_name FROM information_schema.tables "
                        + "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
                String.class);

        assertThat(tables).containsExactlyInAnyOrderElementsOf(EXPECTED_TABLES);
    }

    @Test
    void mapsEveryPgEnumLabelSetToOneToOneOntoJavaEnums() {
        for (Map.Entry<String, Set<String>> expected : EXPECTED_ENUM_LABELS.entrySet()) {
            List<String> labels = jdbcTemplate.queryForList(
                    "SELECT e.enumlabel FROM pg_enum e "
                            + "JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = ? "
                            + "ORDER BY e.enumsortorder",
                    String.class, expected.getKey());

            assertThat(labels)
                    .as("PG enum %s labels", expected.getKey())
                    .containsExactlyInAnyOrderElementsOf(expected.getValue());
        }

        // Java-side mapping (ADR-030: enums live in the owning feature model
        // package). Each assertion also executes the enum constructors so the
        // JaCoCo module gate counts the mapping code.
        assertThat(databaseValues(UserRole::getDatabaseValue, UserRole.values()))
                .containsExactlyInAnyOrder("super_admin", "admin", "manager", "user");
        assertThat(databaseValues(UserStatus::getDatabaseValue, UserStatus.values()))
                .containsExactlyInAnyOrder("active", "inactive", "suspended");
        assertThat(databaseValues(ChannelType::getDatabaseValue, ChannelType.values()))
                .containsExactlyInAnyOrder("telegram", "irc", "whatsapp", "wechat", "meta", "x", "email", "slack");
        assertThat(databaseValues(ConversationStatus::getDatabaseValue, ConversationStatus.values()))
                .containsExactlyInAnyOrder("open", "pending", "resolved");
        assertThat(databaseValues(ConversationPriority::getDatabaseValue, ConversationPriority.values()))
                .containsExactlyInAnyOrder("low", "normal", "high", "urgent");
        assertThat(databaseValues(MessageStatus::getDatabaseValue, MessageStatus.values()))
                .containsExactlyInAnyOrder("pending", "sent", "failed");
        assertThat(databaseValues(MessageDirection::getDatabaseValue, MessageDirection.values()))
                .containsExactlyInAnyOrder("inbound", "outbound");
    }

    @Test
    void reproducesTheLatePocSchemaDeltasNotTheInitialState() {
        // Drizzle 0008: soft delete on users.
        assertThat(columnExists("users", "deleted_at")).isTrue();

        // Drizzle 0007: profile-aware partial uniqueness on conversations.
        Integer partialIndexes = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM pg_indexes "
                        + "WHERE tablename = 'conversations' "
                        + "AND indexname IN ('conversations_external_thread_idx', "
                        + "'conversations_irc_profile_channel_idx') "
                        + "AND indexdef LIKE '%WHERE%'",
                Integer.class);
        assertThat(partialIndexes).isEqualTo(2);

        // Drizzle 0004: active implies enabled on integration profiles.
        Integer checkConstraints = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.table_constraints "
                        + "WHERE table_name = 'integration_connection_profiles' "
                        + "AND constraint_type = 'CHECK' "
                        + "AND constraint_name = 'icp_active_implies_enabled'",
                Integer.class);
        assertThat(checkConstraints).isEqualTo(1);

        // Drizzle 0006 (applied) resolved the duplicate DLQ traceability
        // numbering: irc_profile_id is an integer FK, not the orphaned
        // 0005_add_dlq_traceability_fields uuid shape.
        assertThat(columnExists("dead_letter_queue", "irc_profile_id")).isTrue();
        String dlqIrcProfileType = jdbcTemplate.queryForObject(
                "SELECT data_type FROM information_schema.columns "
                        + "WHERE table_name = 'dead_letter_queue' AND column_name = 'irc_profile_id'",
                String.class);
        assertThat(dlqIrcProfileType).isEqualTo("integer");
    }

    private boolean columnExists(String table, String column) {
        Integer found = jdbcTemplate.queryForObject(
                "SELECT count(*) FROM information_schema.columns "
                        + "WHERE table_name = ? AND column_name = ?",
                Integer.class, table, column);
        return found != null && found > 0;
    }

    private static <E extends Enum<E>> List<String> databaseValues(
            java.util.function.Function<E, String> databaseValue, E[] constants) {
        return java.util.Arrays.stream(constants).map(databaseValue).toList();
    }
}
