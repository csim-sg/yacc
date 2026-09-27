package com.yacc.common.seed;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.repository.AccountRepository;
import com.yacc.auth.repository.PasswordResetTokenRepository;
import com.yacc.auth.repository.SessionRepository;
import com.yacc.auth.repository.UserRepository;
import com.yacc.auth.repository.VerificationRepository;
import com.yacc.audit.repository.AuditLogRepository;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
import com.yacc.conversation.repository.ConversationRepository;
import com.yacc.conversation.repository.ConversationTagRepository;
import com.yacc.dlq.repository.DeadLetterQueueEntryRepository;
import com.yacc.integration.model.IntegrationConnectionProfile;
import com.yacc.integration.repository.IntegrationConfigRepository;
import com.yacc.integration.repository.IntegrationConnectionProfileRepository;
import com.yacc.integration.service.EncryptionService;
import com.yacc.message.repository.AttachmentRepository;
import com.yacc.message.repository.MessageRepository;
import com.yacc.message.repository.RawPayloadRepository;
import com.yacc.note.repository.NoteRepository;
import com.yacc.notification.repository.NotificationRepository;
import com.yacc.routingrule.repository.RoutingRuleExecutionRepository;
import com.yacc.routingrule.repository.RoutingRuleRepository;
import com.yacc.tag.repository.TagRepository;

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
