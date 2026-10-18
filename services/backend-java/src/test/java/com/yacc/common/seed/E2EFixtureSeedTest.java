package com.yacc.common.seed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.context.ApplicationContext;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
import com.yacc.entity.UserRole;
import com.yacc.repository.AccountRepository;
import com.yacc.repository.PasswordResetTokenRepository;
import com.yacc.repository.SessionRepository;
import com.yacc.repository.UserRepository;
import com.yacc.repository.VerificationRepository;
import com.yacc.repository.AuditLogRepository;
import com.yacc.repository.ConversationRepository;
import com.yacc.repository.ConversationTagRepository;
import com.yacc.repository.DeadLetterQueueEntryRepository;
import com.yacc.repository.IntegrationConfigRepository;
import com.yacc.repository.IntegrationConnectionProfileRepository;
import com.yacc.service.EncryptionService;
import com.yacc.repository.AttachmentRepository;
import com.yacc.repository.MessageRepository;
import com.yacc.repository.RawPayloadRepository;
import com.yacc.repository.NoteRepository;
import com.yacc.repository.NotificationRepository;
import com.yacc.repository.RoutingRuleExecutionRepository;
import com.yacc.repository.RoutingRuleRepository;
import com.yacc.repository.TagRepository;

/**
 * PREREQ-ANG-003-S1 entrypoint gates (AC-S1-2/3/4):
 *
 * <ul>
 *   <li><strong>Inert by default</strong> — a non-{@code e2e} boot (this
 *       test-profile context) registers no seed bean/runner;</li>
 *   <li><strong>Fail-closed</strong> — a missing opt-in property or a
 *       non-loopback (production-like) datasource aborts with an explicit
 *       error and zero partial seeding;</li>
 *   <li><strong>No privileged identity</strong> — a successful run creates
 *       no SUPER_ADMIN row (ADR-025 bootstrap exclusivity).</li>
 * </ul>
 */
@Transactional
class E2EFixtureSeedTest extends AbstractPostgresIntegrationTest {

    private static final String PROD_LIKE_URL =
            "jdbc:postgresql://db.cluster.example.com:5432/yacc_prod";

    @Autowired
    private ApplicationContext context;

    private final UserRepository users;
    private final AccountRepository accounts;
    private final SessionRepository sessions;
    private final VerificationRepository verifications;
    private final PasswordResetTokenRepository passwordResetTokens;
    private final ConversationRepository conversations;
    private final ConversationTagRepository conversationTags;
    private final MessageRepository messages;
    private final AttachmentRepository attachments;
    private final RawPayloadRepository rawPayloads;
    private final NoteRepository notes;
    private final TagRepository tags;
    private final RoutingRuleRepository routingRules;
    private final RoutingRuleExecutionRepository routingRuleExecutions;
    private final NotificationRepository notifications;
    private final AuditLogRepository auditLogs;
    private final DeadLetterQueueEntryRepository deadLetterQueue;
    private final IntegrationConfigRepository integrationConfigs;
    private final IntegrationConnectionProfileRepository integrationProfiles;
    private final EncryptionService encryption;

    @Autowired
    E2EFixtureSeedTest(
            UserRepository users,
            AccountRepository accounts,
            SessionRepository sessions,
            VerificationRepository verifications,
            PasswordResetTokenRepository passwordResetTokens,
            ConversationRepository conversations,
            ConversationTagRepository conversationTags,
            MessageRepository messages,
            AttachmentRepository attachments,
            RawPayloadRepository rawPayloads,
            NoteRepository notes,
            TagRepository tags,
            RoutingRuleRepository routingRules,
            RoutingRuleExecutionRepository routingRuleExecutions,
            NotificationRepository notifications,
            AuditLogRepository auditLogs,
            DeadLetterQueueEntryRepository deadLetterQueue,
            IntegrationConfigRepository integrationConfigs,
            IntegrationConnectionProfileRepository integrationProfiles,
            EncryptionService encryption) {
        this.users = users;
        this.accounts = accounts;
        this.sessions = sessions;
        this.verifications = verifications;
        this.passwordResetTokens = passwordResetTokens;
        this.conversations = conversations;
        this.conversationTags = conversationTags;
        this.messages = messages;
        this.attachments = attachments;
        this.rawPayloads = rawPayloads;
        this.notes = notes;
        this.tags = tags;
        this.routingRules = routingRules;
        this.routingRuleExecutions = routingRuleExecutions;
        this.notifications = notifications;
        this.auditLogs = auditLogs;
        this.deadLetterQueue = deadLetterQueue;
        this.integrationConfigs = integrationConfigs;
        this.integrationProfiles = integrationProfiles;
        this.encryption = encryption;
    }

    private E2EFixtureSeed newRunner(boolean seedEnabled, String datasourceUrl) {
        DataSourceProperties datasource = new DataSourceProperties();
        if (datasourceUrl != null) {
            datasource.setUrl(datasourceUrl);
        }
        return new E2EFixtureSeed(users, accounts, sessions, verifications,
                passwordResetTokens, conversations, conversationTags, messages,
                attachments, rawPayloads, notes, tags, routingRules,
                routingRuleExecutions, notifications, auditLogs, deadLetterQueue,
                integrationConfigs, integrationProfiles, encryption,
                new E2EFixtureSeedProperties(seedEnabled), datasource);
    }

    @Test
    void seedBeanIsNotRegisteredOutsideTheE2EProfile() {
        // AC-S1-2: this context boots with the test profile (not e2e) — the
        // gated runner is not registered, so default/production boots can
        // never seed. (The properties record alone is inert data.)
        assertThat(context.getBeanNamesForType(E2EFixtureSeed.class)).isEmpty();
    }

    @Test
    void refusesToRunWithoutTheExplicitOptInProperty() {
        long usersBefore = users.count();
        long conversationsBefore = conversations.count();

        assertThatThrownBy(() -> newRunner(false, null)
                .run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining(E2EFixtureSeedProperties.OPT_IN_PROPERTY);

        // Zero partial seeding.
        assertThat(users.count()).isEqualTo(usersBefore);
        assertThat(conversations.count()).isEqualTo(conversationsBefore);
    }

    @Test
    void refusesToRunAgainstAProductionLikeDatasource() {
        long usersBefore = users.count();
        long conversationsBefore = conversations.count();

        assertThatThrownBy(() -> newRunner(true, PROD_LIKE_URL)
                .run(new DefaultApplicationArguments()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("non-production");

        // Zero partial seeding.
        assertThat(users.count()).isEqualTo(usersBefore);
        assertThat(conversations.count()).isEqualTo(conversationsBefore);
    }

    @Test
    void runAppliesTheSuiteFixtureWorldWithoutAnySuperAdmin() {
        long superAdminsBefore = users.findAll().stream()
                .filter(user -> user.getRole() == UserRole.SUPER_ADMIN)
                .count();
        long usersBefore = users.count();
        long conversationsBefore = conversations.count();

        // The Testcontainers URL is loopback — the guard passes.
        newRunner(true, "jdbc:postgresql://localhost:5432/yacc_e2e_fixture")
                .run(new DefaultApplicationArguments());

        // The suite's non-privileged fixture world exists and is
        // sign-in-reachable; exactly the three fixture identities were added.
        assertThat(users.count()).isEqualTo(usersBefore + 3);
        assertThat(users.findByEmail("admin2@yacc.local")).isPresent();
        assertThat(users.findByEmail("manager@yacc.local")).isPresent();
        assertThat(users.findByEmail("user@yacc.local")).isPresent();
        assertThat(new BCryptPasswordEncoder().matches(
                DeterministicSeed.FIXTURE_USER_PASSWORD,
                users.findByEmail("user@yacc.local").orElseThrow().getPasswordHash())).isTrue();

        // AC-S1-4: no SUPER_ADMIN attributable to the seed (ADR-025).
        assertThat(users.findAll().stream()
                .filter(user -> user.getRole() == UserRole.SUPER_ADMIN).count())
                .isEqualTo(superAdminsBefore);

        // The routing-rule namespace collides with the message namespace
        // across tables — DB-legal by design.
        assertThat(routingRules.findById(
                UUID.fromString("00000000-0000-0000-0000-000000002001"))).isPresent();
        assertThat(conversations.count()).isEqualTo(conversationsBefore + 107);
    }

    @Test
    void datasourceGuardAcceptsOnlyLoopbackHosts() {
        assertThat(E2EFixtureSeed.isLoopbackDatabase(
                "jdbc:postgresql://localhost:5432/yacc_inbox")).isTrue();
        assertThat(E2EFixtureSeed.isLoopbackDatabase(
                "jdbc:postgresql://127.0.0.1:5432/yacc_inbox")).isTrue();
        assertThat(E2EFixtureSeed.isLoopbackDatabase(
                "jdbc:postgresql://LOCALHOST:5432/yacc_inbox")).isTrue();
        assertThat(E2EFixtureSeed.isLoopbackDatabase(PROD_LIKE_URL)).isFalse();
        assertThat(E2EFixtureSeed.isLoopbackDatabase(
                "jdbc:postgresql://10.1.2.3:5432/staging")).isFalse();
        assertThat(E2EFixtureSeed.isLoopbackDatabase(null)).isFalse();
        assertThat(E2EFixtureSeed.isLoopbackDatabase("not-a-jdbc-url")).isFalse();
    }
}
