package com.yacc.common.seed;

import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import com.yacc.auth.model.Account;
import com.yacc.auth.model.PasswordResetToken;
import com.yacc.auth.model.Session;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.model.Verification;
import com.yacc.auth.repository.AccountRepository;
import com.yacc.auth.repository.PasswordResetTokenRepository;
import com.yacc.auth.repository.SessionRepository;
import com.yacc.auth.repository.UserRepository;
import com.yacc.auth.repository.VerificationRepository;
import com.yacc.audit.model.AuditLog;
import com.yacc.audit.repository.AuditLogRepository;
import com.yacc.conversation.model.ChannelType;
import com.yacc.conversation.model.Conversation;
import com.yacc.conversation.model.ConversationTag;
import com.yacc.conversation.model.ConversationTagId;
import com.yacc.conversation.repository.ConversationRepository;
import com.yacc.conversation.repository.ConversationTagRepository;
import com.yacc.dlq.model.DeadLetterQueueEntry;
import com.yacc.dlq.repository.DeadLetterQueueEntryRepository;
import com.yacc.integration.model.IntegrationConfig;
import com.yacc.integration.model.IntegrationConnectionProfile;
import com.yacc.integration.repository.IntegrationConfigRepository;
import com.yacc.integration.repository.IntegrationConnectionProfileRepository;
import com.yacc.integration.service.EncryptionService;
import com.yacc.message.model.Attachment;
import com.yacc.message.model.Message;
import com.yacc.message.model.MessageDirection;
import com.yacc.message.model.MessageStatus;
import com.yacc.message.model.RawPayload;
import com.yacc.message.repository.AttachmentRepository;
import com.yacc.message.repository.MessageRepository;
import com.yacc.message.repository.RawPayloadRepository;
import com.yacc.note.model.Note;
import com.yacc.note.repository.NoteRepository;
import com.yacc.notification.model.Notification;
import com.yacc.notification.repository.NotificationRepository;
import com.yacc.routingrule.model.RoutingRule;
import com.yacc.routingrule.model.RoutingRuleExecution;
import com.yacc.routingrule.repository.RoutingRuleExecutionRepository;
import com.yacc.routingrule.repository.RoutingRuleRepository;
import com.yacc.tag.model.Tag;
import com.yacc.tag.repository.TagRepository;

/**
 * Deterministic full-reset seed for the YACC data layer (MIG-021
 * AC-MIG-021-3; ADR-027 — "deterministic fresh seed, not migrated data").
 *
 * <p>Inserts a fixed, repeatable fixture dataset (stable identifiers in the
 * {@code 00000000-...} fixture range, {@code *.fixture.yacc.local} emails)
 * through the JPA repositories, leaving the database in a known
 * bootstrap-ready state. Deliberate boundaries:</p>
 *
 * <ul>
 *   <li><strong>No Super Admin.</strong> The first SUPER_ADMIN comes into
 *       existence only via the MIG-030 deterministic bootstrap (ADR-025);
 *       this seed never creates privileged identities.</li>
 *   <li><strong>No migrated data.</strong> Nothing is copied from the POC —
 *       every row is a fresh fixture value; no POC-format credential
 *       ciphertext exists (IRC credentials are sealed by the MIG-021
 *       AES-256-GCM {@link EncryptionService}).</li>
 *   <li><strong>Idempotent.</strong> Every insert is insert-if-absent (fixed
 *       ids / natural keys), so re-running against a seeded database is a
 *       no-op and yields the same logical state.</li>
 *   <li><strong>Not wired to startup.</strong> The seed is an explicitly
 *       invoked tool (tests, reset/bootstrap tooling, MIG-071's full reset) —
 *       a plain class, not a startup bean — so application startup never
 *       seeds fixture rows and DB-free Spring contexts are unaffected. It is
 *       a cross-cutting {@code common} data-layer component (ADR-030 §4).</li>
 * </ul>
 */
public class DeterministicSeed {

    /** Fixture plaintext sealed into the IRC profile (fixture-only material). */
    public static final String FIXTURE_IRC_CREDENTIAL = "fixture-irc-nicksecret";

    /** Fixed fixture password for the fixture users (fixture-only material). */
    public static final String FIXTURE_USER_PASSWORD = "fixture-only-password";

    /** Identifiers of the seeded rows, for verification and downstream use. */
    public record SeedState(
            String adminId,
            String managerId,
            String userId,
            Integer ircProfileId,
            UUID telegramConversationId,
            UUID ircConversationId,
            Integer vipTagId,
            UUID inboundMessageId) {
    }

    // Fixed fixture identifiers (00000000-... fixture namespace).
    private static final String ADMIN_ID = "00000000-0000-0000-0000-000000000002";
    private static final String MANAGER_ID = "00000000-0000-0000-0000-000000000003";
    private static final String USER_ID = "00000000-0000-0000-0000-000000000004";
    private static final UUID TELEGRAM_CONVERSATION_ID =
            UUID.fromString("00000000-0000-0000-0000-000000001001");
    private static final UUID IRC_CONVERSATION_ID =
            UUID.fromString("00000000-0000-0000-0000-000000001002");
    private static final UUID INBOUND_MESSAGE_ID =
            UUID.fromString("00000000-0000-0000-0000-000000002001");
    private static final UUID OUTBOUND_MESSAGE_ID =
            UUID.fromString("00000000-0000-0000-0000-000000002002");
    private static final UUID ATTACHMENT_ID = UUID.fromString("00000000-0000-0000-0000-000000003001");
    private static final UUID NOTE_ID = UUID.fromString("00000000-0000-0000-0000-000000004001");
    private static final UUID NOTIFICATION_ID = UUID.fromString("00000000-0000-0000-0000-000000005001");
    private static final UUID RULE_ID = UUID.fromString("00000000-0000-0000-0000-000000006001");
    private static final UUID AUDIT_LOG_ID = UUID.fromString("00000000-0000-0000-0000-000000007001");
    private static final UUID DLQ_ID = UUID.fromString("00000000-0000-0000-0000-000000008001");
    private static final String SESSION_ID = "00000000-0000-0000-0000-000000009001";
    private static final String VERIFICATION_ID = "00000000-0000-0000-0000-000000009101";

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

    public DeterministicSeed(
            UserRepository users, AccountRepository accounts,
            SessionRepository sessions, VerificationRepository verifications,
            PasswordResetTokenRepository passwordResetTokens,
            ConversationRepository conversations, ConversationTagRepository conversationTags,
            MessageRepository messages, AttachmentRepository attachments,
            RawPayloadRepository rawPayloads, NoteRepository notes, TagRepository tags,
            RoutingRuleRepository routingRules, RoutingRuleExecutionRepository routingRuleExecutions,
            NotificationRepository notifications, AuditLogRepository auditLogs,
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

    /**
     * Seeds the deterministic fixture world (idempotent).
     *
     * @return the identifiers of the seeded rows
     */
    public SeedState seed() {
        String adminId = seedUsers();
        Integer ircProfileId = seedIntegration();
        Conversation telegram = seedConversations(adminId, ircProfileId);
        Message inbound = seedMessages(telegram.getId(), adminId);
        seedAggregateRows(telegram.getId(), adminId, MANAGER_ID);

        return new SeedState(ADMIN_ID, MANAGER_ID, USER_ID, ircProfileId,
                telegram.getId(), IRC_CONVERSATION_ID, findVipTag(adminId).orElseThrow().getId(),
                inbound.getId());
    }

    private String seedUsers() {
        String passwordHash = new BCryptPasswordEncoder().encode(FIXTURE_USER_PASSWORD);
        // Fixture identities only — deliberately no super_admin (the first
        // SUPER_ADMIN is created exclusively by the MIG-030 bootstrap).
        upsertUser(ADMIN_ID, "admin@fixture.yacc.local", "Fixture Admin", UserRole.ADMIN, passwordHash);
        upsertUser(MANAGER_ID, "manager@fixture.yacc.local", "Fixture Manager", UserRole.MANAGER, passwordHash);
        upsertUser(USER_ID, "user@fixture.yacc.local", "Fixture User", UserRole.USER, passwordHash);
        return ADMIN_ID;
    }

    private void upsertUser(String id, String email, String name, UserRole role, String passwordHash) {
        if (users.findById(id).isEmpty()) {
            users.save(new User(id, email, name, passwordHash, role, UserStatus.ACTIVE, true));
            accounts.save(new Account(id + "-credential", id, email, "credential"));
        }
    }

    private Integer seedIntegration() {
        if (integrationConfigs.findByPlatform("irc").isEmpty()) {
            IntegrationConfig ircConfig =
                    new IntegrationConfig("irc", "irc.fixture.yacc.local", 6667, "yacc-fixture", "#fixture");
            ircConfig.setUpdatedById(ADMIN_ID);
            integrationConfigs.save(ircConfig);
        }
        IntegrationConnectionProfile profile = integrationProfiles
                .findByIntegrationTypeAndName("irc", "fixture-irc-profile")
                .orElseGet(() -> {
                    // Fresh AES-256-GCM ciphertext (ADR-027) — never a POC
                    // format, never a hardcoded ciphertext.
                    IntegrationConnectionProfile created = new IntegrationConnectionProfile(
                            "irc", "fixture-irc-profile",
                            encryption.encrypt(FIXTURE_IRC_CREDENTIAL),
                            "{\"server\":\"irc.fixture.yacc.local\",\"port\":6667,\"channels\":[\"#fixture\"]}");
                    created.setCreatedById(ADMIN_ID);
                    created.setUpdatedById(ADMIN_ID);
                    return integrationProfiles.save(created);
                });
        return profile.getId();
    }

    private Conversation seedConversations(String adminId, Integer ircProfileId) {
        Conversation telegram = conversations.findById(TELEGRAM_CONVERSATION_ID)
                .orElseGet(() -> {
                    Conversation created = new Conversation(
                            TELEGRAM_CONVERSATION_ID, ChannelType.TELEGRAM, "fixture-tg-101");
                    created.setTitle("Fixture Support Thread");
                    created.setAssignedUserId(adminId);
                    return conversations.save(created);
                });
        if (conversations.findById(IRC_CONVERSATION_ID).isEmpty()) {
            Conversation irc = new Conversation(IRC_CONVERSATION_ID, ChannelType.IRC, "fixture-#support");
            irc.setTitle("Fixture IRC #support");
            irc.setIrcProfileId(ircProfileId);
            conversations.save(irc);
        }
        return telegram;
    }

    private Message seedMessages(UUID conversationId, String adminId) {
        Message inbound = messages.findById(INBOUND_MESSAGE_ID).orElseGet(() -> {
            Message created = new Message(INBOUND_MESSAGE_ID, conversationId, null,
                    "Fixture Sender", "fixture inbound message", MessageDirection.INBOUND);
            created.setStatus(MessageStatus.SENT);
            return messages.save(created);
        });
        if (messages.findById(OUTBOUND_MESSAGE_ID).isEmpty()) {
            Message outbound = new Message(OUTBOUND_MESSAGE_ID, conversationId, adminId,
                    "Fixture Admin", "fixture outbound reply", MessageDirection.OUTBOUND);
            outbound.setStatus(MessageStatus.SENT);
            messages.save(outbound);
        }
        return inbound;
    }

    private void seedAggregateRows(UUID conversationId, String adminId, String managerId) {
        // Tag + join row
        Tag vip = tags.findByNameAndCreatedById("VIP", adminId).orElseGet(() ->
                tags.save(new Tag("VIP", "#2563EB", adminId)));
        ConversationTagId vipJoin = new ConversationTagId(conversationId, vip.getId());
        if (conversationTags.findById(vipJoin).isEmpty()) {
            conversationTags.save(new ConversationTag(vipJoin));
        }
        if (tags.findByNameAndCreatedById("Urgent", adminId).isEmpty()) {
            tags.save(new Tag("Urgent", "#EF4444", adminId));
        }

        // Message-scoped rows (attachment + raw payload)
        if (attachments.findById(ATTACHMENT_ID).isEmpty()) {
            attachments.save(new Attachment(ATTACHMENT_ID, INBOUND_MESSAGE_ID, "fixture.png",
                    "image/png", 1024, "fixture/fixture.png", "https://fixture.yacc.local/fixture.png"));
        }
        if (rawPayloads.findByMessageIdAndPlatform(INBOUND_MESSAGE_ID, "telegram").isEmpty()) {
            rawPayloads.save(new RawPayload(INBOUND_MESSAGE_ID, "telegram",
                    "{\"fixture\":true,\"text\":\"fixture inbound message\"}",
                    LocalDateTime.now().plusDays(7)));
        }

        // Note
        if (notes.findById(NOTE_ID).isEmpty()) {
            Note note = new Note(NOTE_ID, conversationId, adminId, "fixture note");
            note.setMentions("[\"" + managerId + "\"]");
            notes.save(note);
        }

        // Notification
        if (notifications.findById(NOTIFICATION_ID).isEmpty()) {
            notifications.save(new Notification(NOTIFICATION_ID, managerId,
                    "conversation.assigned", conversationId, adminId,
                    "Fixture conversation assigned"));
        }

        // Routing rule + execution
        RoutingRule rule = routingRules.findById(RULE_ID).orElseGet(() ->
                routingRules.save(new RoutingRule(RULE_ID, "fixture-auto-assign", "active", 100,
                        "[{\"field\":\"tag\",\"operator\":\"has\",\"value\":\"VIP\"}]",
                        "[{\"type\":\"assign\",\"value\":\"" + adminId + "\"}]",
                        adminId)));
        if (routingRuleExecutions.findByRuleIdAndConversationId(rule.getId(), conversationId).isEmpty()) {
            routingRuleExecutions.save(new RoutingRuleExecution(rule.getId(), conversationId,
                    "[{\"field\":\"tag\",\"operator\":\"has\",\"value\":\"VIP\"}]",
                    "[{\"type\":\"assign\",\"value\":\"" + adminId + "\"}]"));
        }

        // Audit log
        if (auditLogs.findById(AUDIT_LOG_ID).isEmpty()) {
            auditLogs.save(new AuditLog(AUDIT_LOG_ID, adminId, "fixture.seed",
                    "conversation", conversationId, "127.0.0.1"));
        }

        // DLQ entry
        if (deadLetterQueue.findById(DLQ_ID).isEmpty()) {
            DeadLetterQueueEntry dlq = new DeadLetterQueueEntry(DLQ_ID, INBOUND_MESSAGE_ID,
                    conversationId, "{\"fixture\":true}", "fixture-failure", 3,
                    "fixture last error", LocalDateTime.now().plusDays(7));
            dlq.setCorrelationId("fixture-correlation");
            dlq.setIrcProfileId(ircProfileId());
            deadLetterQueue.save(dlq);
        }

        // Auth artifacts
        if (sessions.findById(SESSION_ID).isEmpty()) {
            sessions.save(new Session(SESSION_ID, USER_ID, LocalDateTime.now().plusHours(1),
                    "fixture-session-token"));
        }
        if (verifications.findById(VERIFICATION_ID).isEmpty()) {
            verifications.save(new Verification(VERIFICATION_ID, "user@fixture.yacc.local",
                    "fixture-verification", LocalDateTime.now().plusHours(1)));
        }
        if (passwordResetTokens.findByToken("fixture-reset-token").isEmpty()) {
            passwordResetTokens.save(new PasswordResetToken(USER_ID, "fixture-reset-token",
                    LocalDateTime.now().plusHours(1)));
        }
    }

    private Integer ircProfileId() {
        return integrationProfiles.findByIntegrationTypeAndName("irc", "fixture-irc-profile")
                .orElseThrow().getId();
    }

    private java.util.Optional<Tag> findVipTag(String adminId) {
        return tags.findByNameAndCreatedById("VIP", adminId);
    }
}
