package com.yacc.common.seed;

import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import com.yacc.entity.Account;
import com.yacc.entity.PasswordResetToken;
import com.yacc.entity.Session;
import com.yacc.entity.User;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.entity.Verification;
import com.yacc.repository.AccountRepository;
import com.yacc.repository.PasswordResetTokenRepository;
import com.yacc.repository.SessionRepository;
import com.yacc.repository.UserRepository;
import com.yacc.repository.VerificationRepository;
import com.yacc.entity.AuditLog;
import com.yacc.repository.AuditLogRepository;
import com.yacc.entity.ChannelType;
import com.yacc.entity.Conversation;
import com.yacc.entity.ConversationTag;
import com.yacc.entity.ConversationTagId;
import com.yacc.repository.ConversationRepository;
import com.yacc.repository.ConversationTagRepository;
import com.yacc.entity.DeadLetterQueueEntry;
import com.yacc.repository.DeadLetterQueueEntryRepository;
import com.yacc.entity.IntegrationConfig;
import com.yacc.entity.IntegrationConnectionProfile;
import com.yacc.repository.IntegrationConfigRepository;
import com.yacc.repository.IntegrationConnectionProfileRepository;
import com.yacc.service.EncryptionService;
import com.yacc.entity.Attachment;
import com.yacc.entity.Message;
import com.yacc.entity.MessageDirection;
import com.yacc.entity.MessageStatus;
import com.yacc.entity.RawPayload;
import com.yacc.repository.AttachmentRepository;
import com.yacc.repository.MessageRepository;
import com.yacc.repository.RawPayloadRepository;
import com.yacc.entity.Note;
import com.yacc.repository.NoteRepository;
import com.yacc.entity.Notification;
import com.yacc.repository.NotificationRepository;
import com.yacc.entity.RoutingRule;
import com.yacc.entity.RoutingRuleExecution;
import com.yacc.repository.RoutingRuleExecutionRepository;
import com.yacc.repository.RoutingRuleRepository;
import com.yacc.entity.Tag;
import com.yacc.repository.TagRepository;

/**
 * Deterministic full-reset seed for the YACC data layer (MIG-021
 * AC-MIG-021-3; ADR-027 — "deterministic fresh seed, not migrated data").
 *
 * <p>Inserts a fixed, repeatable fixture dataset (stable identifiers in the
 * {@code 00000000-...} fixture range) through the JPA repositories, leaving
 * the database in a known bootstrap-ready state. Since PREREQ-ANG-003-S1
 * (issue #423; SPEC-003 AD-5) the fixture world is the Playwright suite's
 * expected non-privileged world: identities {@code admin2@yacc.local}
 * (admin), {@code manager@yacc.local} (manager) and {@code user@yacc.local}
 * (user) with the suite password (see {@link #FIXTURE_USER_PASSWORD}),
 * conversations {@code …1001}/{@code …1002}, tags VIP/Urgent/Follow-Up,
 * routing rules {@code …2001}/{@code …2002}/{@code …2003}, the suite's
 * assignment/mention notifications, and the 105 bulk-action conversations
 * ({@code …3000}..). Deliberate boundaries:</p>
 *
 * <ul>
 *   <li><strong>No Super Admin.</strong> The first SUPER_ADMIN comes into
 *       existence only via the MIG-030 deterministic bootstrap (ADR-025);
 *       this seed never creates privileged identities. The suite's
 *       super-admin credentials map onto that bootstrap identity (test-helper
 *       mapping a-1), never onto a seeded row.</li>
 *   <li><strong>No migrated data.</strong> Nothing is copied from the POC —
 *       every row is a fresh fixture value; no POC-format credential
 *       ciphertext exists (IRC credentials are sealed by the MIG-021
 *       AES-256-GCM {@link EncryptionService}).</li>
 *   <li><strong>Idempotent.</strong> Every insert is insert-if-absent (fixed
 *       ids / natural keys), so re-running against a seeded database is a
 *       no-op and yields the same logical state. Fixture identifiers may
 *       repeat across <em>different</em> tables (e.g. the inbound message id
 *       {@code …2001} and routing-rule PK {@code …2001}) — that is
 *       DB-legal and intentional.</li>
 *   <li><strong>Not wired to startup.</strong> The seed is an explicitly
 *       invoked tool (tests, the profile/opt-in-gated E2E entrypoint, and
 *       reset/bootstrap tooling) — a plain class, not a startup bean — so
 *       application startup never seeds fixture rows and DB-free Spring
 *       contexts are unaffected. It is a cross-cutting {@code common}
 *       data-layer component (ADR-030 §4).</li>
 * </ul>
 */
public class DeterministicSeed {

    /** Fixture plaintext sealed into the IRC profile (fixture-only material). */
    public static final String FIXTURE_IRC_CREDENTIAL = "fixture-irc-nicksecret";

    /**
     * Fixed fixture password for the three fixture users (fixture-only
     * material). PREREQ-ANG-003-S1 aligned this with the value the Playwright
     * suite sends for every fixture identity ({@code admin123}) so the seeded
     * world is sign-in-reachable through the frozen auth contract.
     */
    public static final String FIXTURE_USER_PASSWORD = "admin123";

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
    private static final UUID AUDIT_LOG_ID = UUID.fromString("00000000-0000-0000-0000-000000007001");
    private static final UUID DLQ_ID = UUID.fromString("00000000-0000-0000-0000-000000008001");
    private static final String SESSION_ID = "00000000-0000-0000-0000-000000009001";
    private static final String VERIFICATION_ID = "00000000-0000-0000-0000-000000009101";

    /** Suite routing-rule identifiers (fixtures.ts FIXTURE_IDS.routingRules). */
    private static final UUID RULE_AUTO_ASSIGN_VIP_ID =
            UUID.fromString("00000000-0000-0000-0000-000000002001");
    private static final UUID RULE_AUTO_TAG_URGENT_ID =
            UUID.fromString("00000000-0000-0000-0000-000000002002");
    private static final UUID RULE_DISABLED_ID =
            UUID.fromString("00000000-0000-0000-0000-000000002003");

    /** Suite notification identifiers (assignment/mention fixtures). */
    private static final UUID MANAGER_ASSIGNMENT_NOTIFICATION_ID =
            UUID.fromString("00000000-0000-0000-0000-000000005001");
    private static final UUID USER_MENTION_NOTIFICATION_ID =
            UUID.fromString("00000000-0000-0000-0000-000000005002");
    private static final UUID ADMIN_ASSIGNMENT_NOTIFICATION_ID =
            UUID.fromString("00000000-0000-0000-0000-000000005003");

    /** Suite bulk-action conversation range: …3000..…3104 (105 rows). */
    private static final int BULK_CONVERSATION_COUNT = 105;
    private static final int BULK_CONVERSATION_START_ID = 3000;

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
        // Suite fixture identities only — deliberately no super_admin (the
        // first SUPER_ADMIN is created exclusively by the MIG-030 bootstrap;
        // the suite's super-admin credentials are served by test-helper
        // mapping a-1 onto that bootstrap identity).
        upsertUser(ADMIN_ID, "admin2@yacc.local", "Admin User", UserRole.ADMIN, passwordHash);
        upsertUser(MANAGER_ID, "manager@yacc.local", "Manager User", UserRole.MANAGER, passwordHash);
        upsertUser(USER_ID, "user@yacc.local", "Support User", UserRole.USER, passwordHash);
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
        // Suite tags: VIP (admin), Urgent (admin), Follow-Up (manager).
        Tag vip = tags.findByNameAndCreatedById("VIP", adminId).orElseGet(() ->
                tags.save(new Tag("VIP", "#2563EB", adminId)));
        ConversationTagId vipJoin = new ConversationTagId(conversationId, vip.getId());
        if (conversationTags.findById(vipJoin).isEmpty()) {
            conversationTags.save(new ConversationTag(vipJoin));
        }
        if (tags.findByNameAndCreatedById("Urgent", adminId).isEmpty()) {
            tags.save(new Tag("Urgent", "#EF4444", adminId));
        }
        if (tags.findByNameAndCreatedById("Follow-Up", managerId).isEmpty()) {
            tags.save(new Tag("Follow-Up", "#F97316", managerId));
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

        // Suite notifications (assignment/mention fixtures; helpers/api.ts
        // Notification type union assignment|mention).
        if (notifications.findById(MANAGER_ASSIGNMENT_NOTIFICATION_ID).isEmpty()) {
            notifications.save(new Notification(MANAGER_ASSIGNMENT_NOTIFICATION_ID, managerId,
                    "assignment", conversationId, adminId,
                    "Fixture conversation assigned"));
        }
        if (notifications.findById(USER_MENTION_NOTIFICATION_ID).isEmpty()) {
            notifications.save(new Notification(USER_MENTION_NOTIFICATION_ID, USER_ID,
                    "mention", IRC_CONVERSATION_ID, managerId,
                    "Fixture conversation mention"));
        }
        if (notifications.findById(ADMIN_ASSIGNMENT_NOTIFICATION_ID).isEmpty()) {
            Notification read = new Notification(ADMIN_ASSIGNMENT_NOTIFICATION_ID, adminId,
                    "assignment", IRC_CONVERSATION_ID, adminId,
                    "Fixture conversation assigned");
            read.setRead(true);
            notifications.save(read);
        }

        // Suite routing rules …2001/2002/2003 (fixtures.ts routingRules) —
        // the id overlap with the message namespace above is cross-table and
        // DB-legal by design.
        RoutingRule autoAssignVip = routingRules.findById(RULE_AUTO_ASSIGN_VIP_ID).orElseGet(() ->
                routingRules.save(new RoutingRule(RULE_AUTO_ASSIGN_VIP_ID,
                        "Auto-assign VIP to admin", "active", 100,
                        "[{\"field\":\"tag\",\"operator\":\"has\",\"value\":\"VIP\"}]",
                        "[{\"type\":\"assign\",\"value\":\"" + adminId + "\"}]",
                        adminId)));
        if (routingRules.findById(RULE_AUTO_TAG_URGENT_ID).isEmpty()) {
            routingRules.save(new RoutingRule(RULE_AUTO_TAG_URGENT_ID,
                    "Auto-tag urgent keywords", "active", 101,
                    "[{\"field\":\"keyword\",\"operator\":\"contains\",\"value\":\"yacc-seed-urgent-keyword-xyz\"}]",
                    "[{\"type\":\"priority\",\"value\":\"high\"}]",
                    adminId));
        }
        if (routingRules.findById(RULE_DISABLED_ID).isEmpty()) {
            routingRules.save(new RoutingRule(RULE_DISABLED_ID,
                    "Disabled rule for testing", "disabled", 102,
                    "[{\"field\":\"channel\",\"operator\":\"eq\",\"value\":\"telegram\"}]",
                    "[{\"type\":\"priority\",\"value\":\"low\"}]",
                    adminId));
        }
        if (routingRuleExecutions
                .findByRuleIdAndConversationId(autoAssignVip.getId(), conversationId).isEmpty()) {
            routingRuleExecutions.save(new RoutingRuleExecution(autoAssignVip.getId(), conversationId,
                    "[{\"field\":\"tag\",\"operator\":\"has\",\"value\":\"VIP\"}]",
                    "[{\"type\":\"assign\",\"value\":\"" + adminId + "\"}]"));
        }

        // Suite bulk-action conversations …3000..…3104 (105 rows; max-100
        // bulk limit + overflow evidence for the suite's bulk tests).
        for (int i = 0; i < BULK_CONVERSATION_COUNT; i++) {
            UUID bulkId = bulkConversationId(i);
            if (conversations.findById(bulkId).isEmpty()) {
                Conversation bulk = new Conversation(bulkId,
                        i % 2 == 0 ? ChannelType.TELEGRAM : ChannelType.IRC,
                        "bulk-test-" + i);
                bulk.setTitle("Bulk Test Conversation " + (i + 1));
                if (i % 3 == 0) {
                    bulk.setAssignedUserId(managerId);
                }
                conversations.save(bulk);
            }
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
            verifications.save(new Verification(VERIFICATION_ID, "user@yacc.local",
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

    /** Deterministic bulk-conversation identifier {@code …3000+i} (12 digits). */
    private static UUID bulkConversationId(int index) {
        return UUID.fromString("00000000-0000-0000-0000-"
                + String.format("%012d", BULK_CONVERSATION_START_ID + index));
    }
}
