package com.yacc.common.migration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;

/**
 * MIG-020 acceptance evidence: the Flyway V1/V2 baseline, run by Spring Boot
 * against the {@code postgres:15-alpine} Testcontainers instance (MIG-014
 * harness), reproduces the re-expressed POC schema with a monotonic history.
 *
 * <p>AC-MIG-020-1 — V1 re-expresses all 19 POC tables (enumerated
 * individually below, exactly the {@code packages/backend/src/schemas/*.schema.ts}
 * ledger set). AC-MIG-020-2 — the duplicate POC {@code 0005_*}/{@code 0006_*}
 * numbering resolves into a single monotonic Flyway sequence. AC-MIG-020-3 —
 * all 7 PostgreSQL enums are present with their exact label sets and the
 * ADR-028 {@code websocket_backlog} table exists.</p>
 *
 * <p>Reconciliation spot-checks additionally pin the final evolved state:
 * columns introduced late in the POC history (users.deleted_at,
 * conversations.irc_profile_id, dead_letter_queue tracing columns) and the
 * CHECK/partial-unique/FK shapes that the orphan POC migration
 * {@code 0005_add_dlq_traceability_fields} got wrong (uuid FK) — the applied
 * {@code 0006_add_dlq_tracing_fields} shape (integer FK) must win.</p>
 *
 * <p>MIG-063 added Flyway V4 (ADR-028: Quartz DB-backed job store): the
 * monotonic sequence continues at 4 and the 11 {@code qrtz_*} store tables
 * (the verbatim Quartz 2.5.2 PostgreSQL script) exist alongside the
 * application schema.</p>
 */
class FlywayMigrationIntegrationTest extends AbstractPostgresIntegrationTest {

    /** The 19 re-expressed POC tables (AC-MIG-020-1), enumerated individually. */
    private static final List<String> BASELINE_TABLES = List.of(
            "users",
            "account",
            "session",
            "verification",
            "attachments",
            "audit_logs",
            "conversations",
            "conversation_tags",
            "dead_letter_queue",
            "integration_configs",
            "integration_connection_profiles",
            "messages",
            "notes",
            "notifications",
            "password_reset_tokens",
            "raw_payloads",
            "routing_rules",
            "routing_rule_executions",
            "tags");

    /** The 11 Quartz job-store tables (Flyway V4; MIG-063, ADR-028). */
    private static final List<String> QUARTZ_STORE_TABLES = List.of(
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

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void reExpressesExactlyTheNineteenBaselineTablesPlusBacklogAndQuartzStore() {
        List<String> tables = jdbcTemplate.queryForList(
                "SELECT table_name FROM information_schema.tables"
                        + " WHERE table_schema = 'public' ORDER BY table_name",
                String.class);

        // Exactly the 19 re-expressed tables + websocket_backlog (ADR-028, V2)
        // + the 11 Quartz job-store tables (ADR-028, V4) + Flyway's own
        // history table. Nothing else — no unrelated schema.
        List<String> expected = new ArrayList<>(BASELINE_TABLES);
        expected.add("websocket_backlog");
        expected.addAll(QUARTZ_STORE_TABLES);
        expected.add("flyway_schema_history");
        assertThat(tables).containsExactlyInAnyOrderElementsOf(expected);
    }

    @Test
    void historyIsASingleMonotonicSequenceWithoutDuplicates() {
        List<String> versions = jdbcTemplate.queryForList(
                "SELECT version FROM flyway_schema_history ORDER BY installed_rank",
                String.class);
        List<Boolean> successes = jdbcTemplate.queryForList(
                "SELECT success FROM flyway_schema_history ORDER BY installed_rank",
                Boolean.class);

        // AC-MIG-020-2: the duplicate 0005/0006 POC numbering collapses into
        // one clean sequence, all applied cleanly. V1 baseline + V2 backlog
        // (ADR-028) + V3 forced-password-change flag (MIG-030, ADR-025) +
        // V4 Quartz job store (MIG-063, ADR-028).
        assertThat(versions).containsExactly("1", "2", "3", "4");
        assertThat(successes).containsExactly(true, true, true, true);
    }

    @Test
    void quartzJobStoreCarriesTheCanonicalPostgresShape() {
        List<String> jobDetailColumns = jdbcTemplate.queryForList(
                "SELECT column_name FROM information_schema.columns"
                        + " WHERE table_schema = 'public' AND table_name = 'qrtz_job_details'"
                        + " ORDER BY ordinal_position",
                String.class);
        Integer triggerForeignKeys = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_constraint WHERE conname ="
                        + " 'qrtz_triggers_sched_name_job_name_job_group_fkey' AND contype = 'f'",
                Integer.class);

        // The verbatim Quartz 2.5.2 PostgreSQL script shape: the store owns
        // its schema; Quartz's runtime SQL addresses it unquoted (lowercase
        // folding).
        assertThat(jobDetailColumns).containsExactly(
                "sched_name", "job_name", "job_group", "description", "job_class_name",
                "is_durable", "is_nonconcurrent", "is_update_data", "requests_recovery",
                "job_data");
        assertThat(triggerForeignKeys).isEqualTo(1);
    }

    @Test
    void reExpressesAllSevenPostgresEnumsWithExactLabels() {
        List<String> typeLabels = jdbcTemplate.queryForList(
                "SELECT t.typname || '=' || e.enumlabel"
                        + " FROM pg_type t"
                        + " JOIN pg_enum e ON e.enumtypid = t.oid"
                        + " JOIN pg_namespace n ON n.oid = t.typnamespace"
                        + " WHERE n.nspname = 'public'"
                        + " ORDER BY t.typname, e.enumsortorder",
                String.class);

        // AC-MIG-020-3 (enum half): exact type/label surface, no extras.
        assertThat(typeLabels).containsExactly(
                // channel_type
                "channel_type=telegram",
                "channel_type=irc",
                "channel_type=whatsapp",
                "channel_type=wechat",
                "channel_type=meta",
                "channel_type=x",
                "channel_type=email",
                "channel_type=slack",
                // conversation_priority (post-0002: 'medium' -> 'normal')
                "conversation_priority=low",
                "conversation_priority=normal",
                "conversation_priority=high",
                "conversation_priority=urgent",
                // conversation_status
                "conversation_status=open",
                "conversation_status=pending",
                "conversation_status=resolved",
                // message_direction
                "message_direction=inbound",
                "message_direction=outbound",
                // message_status
                "message_status=pending",
                "message_status=sent",
                "message_status=failed",
                // user_role
                "user_role=super_admin",
                "user_role=admin",
                "user_role=manager",
                "user_role=user",
                // user_status
                "user_status=active",
                "user_status=inactive",
                "user_status=suspended");
    }

    @Test
    void websocketBacklogMirrorsPocEntryShape() {
        List<String> columns = jdbcTemplate.queryForList(
                "SELECT column_name FROM information_schema.columns"
                        + " WHERE table_schema = 'public' AND table_name = 'websocket_backlog'"
                        + " ORDER BY ordinal_position",
                String.class);

        // AC-MIG-020-3 (backlog half): the ADR-028 table with the POC
        // BacklogEntry fields (event-backlog.service.ts, 1h rolling window).
        assertThat(columns).containsExactly(
                "id", "user_id", "event_name", "conversation_id",
                "payload", "emitted_at", "expires_at");
    }

    @Test
    void keepsTheFinalEvolvedColumnShapes() {
        List<String> columnTypes = jdbcTemplate.queryForList(
                "SELECT table_name || '.' || column_name || '=' || data_type"
                        + " FROM information_schema.columns"
                        + " WHERE table_schema = 'public'"
                        + " AND (table_name, column_name) IN ("
                        + "   ('users', 'deleted_at'),"
                        + "   ('conversations', 'irc_profile_id'),"
                        + "   ('dead_letter_queue', 'irc_profile_id'))"
                        + " ORDER BY table_name, column_name",
                String.class);

        // Final POC history state: users.deleted_at (0008), the applied
        // 0005_add_irc_profile_to_conversations, and the applied
        // 0006_add_dlq_tracing_fields — whose integer FK proves the orphan
        // 0005_add_dlq_traceability_fields (uuid, no FK) is dead, i.e. the
        // duplicate numbering is truly resolved, not carried forward.
        assertThat(columnTypes).containsExactly(
                "conversations.irc_profile_id=integer",
                "dead_letter_queue.irc_profile_id=integer",
                "users.deleted_at=timestamp without time zone");
    }

    @Test
    void keepsTheEvolvedConstraintAndIndexShapes() {
        Integer icpCheck = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_constraint"
                        + " WHERE conname = 'icp_active_implies_enabled' AND contype = 'c'",
                Integer.class);
        List<String> partialIndexes = jdbcTemplate.queryForList(
                "SELECT indexdef FROM pg_indexes WHERE indexname IN ("
                        + " 'conversations_irc_profile_channel_idx',"
                        + " 'conversations_external_thread_idx',"
                        + " 'integration_profiles_active_idx')"
                        + " ORDER BY indexname",
                String.class);
        Integer dlqProfileFk = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pg_constraint WHERE conname ="
                        + " 'dead_letter_queue_irc_profile_id_integration_connection_profiles_id_fk'"
                        + " AND contype = 'f'",
                Integer.class);

        // "active implies enabled" CHECK (0004); partial unique indexes
        // (0007 conversation uniqueness + 0004 active-profile uniqueness);
        // the DLQ → integration_connection_profiles FK (0006).
        assertThat(icpCheck).isEqualTo(1);
        assertThat(partialIndexes).hasSize(3)
                .allSatisfy(def -> assertThat(def).contains(" WHERE "));
        assertThat(dlqProfileFk).isEqualTo(1);
    }
}
