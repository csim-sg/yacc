package com.yacc.common.seed;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import com.yacc.entity.UserRole;
import com.yacc.repository.AccountRepository;
import com.yacc.repository.PasswordResetTokenRepository;
import com.yacc.repository.SessionRepository;
import com.yacc.repository.UserRepository;
import com.yacc.repository.VerificationRepository;
import com.yacc.repository.AuditLogRepository;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
import com.yacc.repository.ConversationRepository;
import com.yacc.repository.ConversationTagRepository;
import com.yacc.repository.DeadLetterQueueEntryRepository;
import com.yacc.entity.IntegrationConnectionProfile;
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
 * MIG-021 seed verification (AC-MIG-021-3): the deterministic seed produces
 * a bootstrap-ready database — fixed fixture identifiers across the full data
 * layer, IRC credentials sealed with the MIG-021 AES-256-GCM service, and
 * bootstrap exclusivity (no SUPER_ADMIN row exists — the first Super Admin is
 * created only by the MIG-030 deterministic bootstrap, ADR-025).
 *
 * <p>Runs twice to prove idempotency: the second pass is a no-op that leaves
 * the same logical state.</p>
 */
@Transactional
class DeterministicSeedIntegrationTest extends AbstractPostgresIntegrationTest {

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

    /**
     * Constructor injection only (ARCH-004 §2 / ADR-024 / ADR-030) — also
     * applies to Spring context tests: {@code SpringExtension} autowires the
     * parameters of this single {@code @Autowired} constructor.
     */
    @Autowired
    DeterministicSeedIntegrationTest(
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

    private DeterministicSeed newSeed() {
        return new DeterministicSeed(users, accounts, sessions, verifications,
                passwordResetTokens, conversations, conversationTags, messages,
                attachments, rawPayloads, notes, tags, routingRules,
                routingRuleExecutions, notifications, auditLogs, deadLetterQueue,
                integrationConfigs, integrationProfiles, encryption);
    }

    @Test
    void seedProducesDeterministicBootstrapReadyState() {
        DeterministicSeed.SeedState state = newSeed().seed();

        // Fixed identifiers — determinism contract.
        assertThat(state.adminId()).isEqualTo("00000000-0000-0000-0000-000000000002");
        assertThat(state.telegramConversationId())
                .isEqualTo(UUID.fromString("00000000-0000-0000-0000-000000001001"));

        // Bootstrap-ready: the three fixture identities exist, and the only
        // SUPER_ADMIN is the deterministic MIG-030 bootstrap identity created
        // at context startup (application-test.yml configuration) — the seed
        // itself still never creates privileged identities (ADR-025).
        assertThat(users.findAll()).hasSize(4);
        assertThat(users.findAll().stream()
                .filter(user -> !user.getEmail().endsWith("bootstrap@fixture.yacc.local"))
                .toList())
                .hasSize(3)
                .allSatisfy(user -> assertThat(user.getRole()).isNotEqualTo(UserRole.SUPER_ADMIN));
        assertThat(users.findByEmail("bootstrap@fixture.yacc.local").orElseThrow().getRole())
                .isEqualTo(UserRole.SUPER_ADMIN);
        assertThat(users.findById(state.adminId()).orElseThrow().getRole())
                .isEqualTo(UserRole.ADMIN);

        // PREREQ-ANG-003-S1: the fixture identities are the suite's
        // non-privileged world, sign-in-reachable under the frozen auth
        // contract (suite emails + suite password).
        org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder encoder =
                new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
        assertThat(users.findByEmail("admin2@yacc.local").orElseThrow().getRole())
                .isEqualTo(UserRole.ADMIN);
        assertThat(users.findByEmail("manager@yacc.local").orElseThrow().getRole())
                .isEqualTo(UserRole.MANAGER);
        assertThat(users.findByEmail("user@yacc.local").orElseThrow().getRole())
                .isEqualTo(UserRole.USER);
        assertThat(encoder.matches(DeterministicSeed.FIXTURE_USER_PASSWORD,
                users.findByEmail("manager@yacc.local").orElseThrow().getPasswordHash())).isTrue();

        // Seeded IRC credential is AES-256-GCM ciphertext of the fixture
        // secret — decryptable with the fresh-key service, never POC format.
        IntegrationConnectionProfile profile =
                integrationProfiles.findById(state.ircProfileId()).orElseThrow();
        assertThat(profile.getEncryptedCredentials())
                .isNotEqualTo(DeterministicSeed.FIXTURE_IRC_CREDENTIAL);
        assertThat(encryption.decrypt(profile.getEncryptedCredentials()))
                .isEqualTo(DeterministicSeed.FIXTURE_IRC_CREDENTIAL);

        // The fixture world spans the data layer: conversation, messages,
        // tag, DLQ, WS backlog rows all exist under fixed identifiers.
        assertThat(conversations.findById(state.telegramConversationId())).isPresent();
        assertThat(conversations.findById(state.ircConversationId()).orElseThrow()
                .getIrcProfileId()).isEqualTo(state.ircProfileId());
        assertThat(messages.findById(state.inboundMessageId())).isPresent();
        assertThat(tags.findById(state.vipTagId())).isPresent();
        assertThat(deadLetterQueue.count()).isEqualTo(1);

        // PREREQ-ANG-003-S1 suite world: three routing rules under the
        // fixtures.ts identifiers, the Follow-Up tag, the three
        // assignment/mention notifications, and the 105 bulk conversations.
        assertThat(routingRules.findById(
                UUID.fromString("00000000-0000-0000-0000-000000002001")).orElseThrow().getName())
                .isEqualTo("Auto-assign VIP to admin");
        assertThat(routingRules.findById(
                UUID.fromString("00000000-0000-0000-0000-000000002002")).orElseThrow().getName())
                .isEqualTo("Auto-tag urgent keywords");
        assertThat(routingRules.findById(
                UUID.fromString("00000000-0000-0000-0000-000000002003")).orElseThrow().getStatus())
                .isEqualTo("disabled");
        assertThat(tags.findByNameAndCreatedById("Follow-Up",
                users.findByEmail("manager@yacc.local").orElseThrow().getId())).isPresent();
        assertThat(notifications.findById(
                UUID.fromString("00000000-0000-0000-0000-000000005001")).orElseThrow().getType())
                .isEqualTo("assignment");
        assertThat(notifications.findById(
                UUID.fromString("00000000-0000-0000-0000-000000005002")).orElseThrow().getType())
                .isEqualTo("mention");
        assertThat(notifications.findById(
                UUID.fromString("00000000-0000-0000-0000-000000005003")).orElseThrow().isRead())
                .isTrue();
        for (int i = 0; i < 105; i++) {
            assertThat(conversations.findById(UUID.fromString("00000000-0000-0000-0000-"
                    + String.format("%012d", 3000 + i)))).isPresent();
        }
    }

    @Test
    void seedIsIdempotent() {
        DeterministicSeed seed = newSeed();
        DeterministicSeed.SeedState first = seed.seed();

        long usersBefore = users.count();
        long conversationsBefore = conversations.count();
        long messagesBefore = messages.count();
        long tagsBefore = tags.count();
        long dlqBefore = deadLetterQueue.count();

        DeterministicSeed.SeedState second = seed.seed();

        // Same logical state, no duplicated rows.
        assertThat(second).isEqualTo(first);
        assertThat(users.count()).isEqualTo(usersBefore);
        assertThat(conversations.count()).isEqualTo(conversationsBefore);
        assertThat(messages.count()).isEqualTo(messagesBefore);
        assertThat(tags.count()).isEqualTo(tagsBefore);
        assertThat(deadLetterQueue.count()).isEqualTo(dlqBefore);
    }
}
