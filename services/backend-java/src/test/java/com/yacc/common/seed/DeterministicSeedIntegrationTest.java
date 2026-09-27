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

    @Autowired
    private UserRepository users;
    @Autowired
    private AccountRepository accounts;
    @Autowired
    private SessionRepository sessions;
    @Autowired
    private VerificationRepository verifications;
    @Autowired
    private PasswordResetTokenRepository passwordResetTokens;
    @Autowired
    private ConversationRepository conversations;
    @Autowired
    private ConversationTagRepository conversationTags;
    @Autowired
    private MessageRepository messages;
    @Autowired
    private AttachmentRepository attachments;
    @Autowired
    private RawPayloadRepository rawPayloads;
    @Autowired
    private NoteRepository notes;
    @Autowired
    private TagRepository tags;
    @Autowired
    private RoutingRuleRepository routingRules;
    @Autowired
    private RoutingRuleExecutionRepository routingRuleExecutions;
    @Autowired
    private NotificationRepository notifications;
    @Autowired
    private AuditLogRepository auditLogs;
    @Autowired
    private DeadLetterQueueEntryRepository deadLetterQueue;
    @Autowired
    private IntegrationConfigRepository integrationConfigs;
    @Autowired
    private IntegrationConnectionProfileRepository integrationProfiles;
    @Autowired
    private EncryptionService encryption;

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

        // Bootstrap-ready: fixture identities exist, but NO super_admin —
        // the first SUPER_ADMIN comes only from the MIG-030 bootstrap.
        assertThat(users.findAll()).hasSize(3)
                .allSatisfy(user -> assertThat(user.getRole()).isNotEqualTo(UserRole.SUPER_ADMIN));
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
