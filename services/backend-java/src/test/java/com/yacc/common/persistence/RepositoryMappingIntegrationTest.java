package com.yacc.common.persistence;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
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
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
import com.yacc.conversation.model.ChannelType;
import com.yacc.conversation.model.Conversation;
import com.yacc.conversation.model.ConversationPriority;
import com.yacc.conversation.model.ConversationStatus;
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
 * MIG-021 repository verification: every entity round-trips a real
 * PostgreSQL schema (MIG-020 Flyway baseline) through its Spring Data JPA
 * repository — column/type fidelity, PostgreSQL native enum translation via
 * the MIG-020 label converters, jsonb JSON documents, client-generated UUID
 * keys and database-generated serial keys (AC-MIG-021-1).
 */
@Transactional
class RepositoryMappingIntegrationTest extends AbstractPostgresIntegrationTest {

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

    /**
     * Constructor injection only (ARCH-004 §2 / ADR-024 / ADR-030) — also
     * applies to Spring context tests: {@code SpringExtension} autowires the
     * parameters of this single {@code @Autowired} constructor.
     */
    @Autowired
    RepositoryMappingIntegrationTest(
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
            IntegrationConnectionProfileRepository integrationProfiles) {
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
    }

    /**
     * The schema enforces real FK constraints — child-row tests persist their
     * parent user first.
     */
    private String givenUser(String id) {
        users.saveAndFlush(new User(id, id + "@fixture.yacc.local", "Parent User",
                "hash", UserRole.USER, UserStatus.ACTIVE, true));
        return id;
    }

    /** Parent integration profile for conversation/DLQ irc_profile_id FKs. */
    private Integer givenIrcProfile() {
        IntegrationConnectionProfile profile = integrationProfiles.saveAndFlush(
                new IntegrationConnectionProfile("irc", "fk-parent-profile", "sealed", "{}"));
        return profile.getId();
    }

    @Test
    void userRoundTripsNativeEnumRolesAndStatuses() {
        User user = new User("user-1", "roundtrip@fixture.yacc.local", "Round Trip",
                "hash", UserRole.SUPER_ADMIN, UserStatus.SUSPENDED, true);
        users.saveAndFlush(user);

        User reloaded = users.findById("user-1").orElseThrow();
        assertThat(reloaded.getRole()).isEqualTo(UserRole.SUPER_ADMIN);
        assertThat(reloaded.getStatus()).isEqualTo(UserStatus.SUSPENDED);
        assertThat(reloaded.isEmailVerified()).isTrue();
    }

    @Test
    void accountSessionVerificationAndResetTokenRoundTrip() {
        String userId = givenUser("user-acct-1");
        accounts.saveAndFlush(new Account("acct-1", userId, "roundtrip@fixture.yacc.local", "credential"));
        sessions.saveAndFlush(new Session("sess-1", userId,
                LocalDateTime.now().plusHours(1), "token-1"));
        verifications.saveAndFlush(new Verification("ver-1", "roundtrip@fixture.yacc.local",
                "value-1", LocalDateTime.now().plusHours(1)));
        PasswordResetToken reset = passwordResetTokens.saveAndFlush(
                new PasswordResetToken(userId, "reset-token-1", LocalDateTime.now().plusHours(1)));

        assertThat(accounts.findById("acct-1")).isPresent();
        assertThat(sessions.findByToken("token-1")).isPresent();
        assertThat(verifications.findById("ver-1")).isPresent();
        assertThat(passwordResetTokens.findByToken("reset-token-1")).isPresent();
        // Serial identity: the database assigns the reset-token id.
        assertThat(reset.getId()).isNotNull();
    }

    @Test
    void conversationRoundTripsNativeEnumsAndGeneratedUuid() {
        String userId = givenUser("user-conv-1");
        Integer profileId = givenIrcProfile();

        // Client-side UUID generation when no id is supplied.
        Conversation generated = conversations.saveAndFlush(
                new Conversation(null, ChannelType.TELEGRAM, "gen-thread"));
        assertThat(generated.getId()).isNotNull();

        Conversation irc = new Conversation(UUID.fromString(
                "00000000-0000-0000-0000-00000000aa01"), ChannelType.IRC, "roundtrip-irc");
        irc.setStatus(ConversationStatus.PENDING);
        irc.setPriority(ConversationPriority.URGENT);
        irc.setAssignedUserId(userId);
        irc.setMetadata("{\"fixture\":true}");
        irc.setIrcProfileId(profileId);
        conversations.saveAndFlush(irc);

        Conversation reloaded = conversations.findById(irc.getId()).orElseThrow();
        assertThat(reloaded.getChannel()).isEqualTo(ChannelType.IRC);
        assertThat(reloaded.getStatus()).isEqualTo(ConversationStatus.PENDING);
        assertThat(reloaded.getPriority()).isEqualTo(ConversationPriority.URGENT);
        assertThat(reloaded.getAssignedUserId()).isEqualTo(userId);
        assertThat(reloaded.getMetadata()).isEqualTo("{\"fixture\":true}");
        assertThat(reloaded.getIrcProfileId()).isEqualTo(profileId);
    }

    @Test
    void conversationTagCompositeKeyRoundTrips() {
        String userId = givenUser("user-join-1");
        Conversation conversation = conversations.saveAndFlush(
                new Conversation(null, ChannelType.TELEGRAM, "join-thread"));
        Tag tag = tags.saveAndFlush(new Tag("roundtrip-tag", "#000000", userId));

        ConversationTagId id = new ConversationTagId(conversation.getId(), tag.getId());
        conversationTags.saveAndFlush(new ConversationTag(id));

        assertThat(conversationTags.findById(id)).isPresent();
    }

    @Test
    void messageAttachmentAndRawPayloadRoundTrip() {
        Conversation conversation = conversations.saveAndFlush(
                new Conversation(null, ChannelType.TELEGRAM, "msg-thread"));
        Message message = new Message(null, conversation.getId(), null,
                "External Sender", "hello", MessageDirection.INBOUND);
        message.setStatus(MessageStatus.FAILED);
        messages.saveAndFlush(message);

        Message reloaded = messages.findById(message.getId()).orElseThrow();
        assertThat(reloaded.getDirection()).isEqualTo(MessageDirection.INBOUND);
        assertThat(reloaded.getStatus()).isEqualTo(MessageStatus.FAILED);
        assertThat(reloaded.getSenderId()).isNull();
        assertThat(reloaded.getSenderName()).isEqualTo("External Sender");

        Attachment attachment = attachments.saveAndFlush(new Attachment(null, message.getId(),
                "a.png", "image/png", 10, "k", "https://fixture.yacc.local/a.png"));
        RawPayload payload = rawPayloads.saveAndFlush(new RawPayload(message.getId(),
                "telegram", "{\"hello\":\"world\"}", LocalDateTime.now().plusDays(7)));

        assertThat(attachments.findById(attachment.getId())).isPresent();
        assertThat(rawPayloads.findByMessageIdAndPlatform(message.getId(), "telegram"))
                .contains(payload);
        assertThat(payload.getId()).isNotNull();
    }

    @Test
    void noteNotificationAuditRoundTrip() {
        String userId = givenUser("user-agg-1");
        Conversation conversation = conversations.saveAndFlush(
                new Conversation(null, ChannelType.TELEGRAM, "agg-thread"));
        Note note = notes.saveAndFlush(new Note(null, conversation.getId(), userId, "note body"));
        note.setMentions("[\"user-2\"]");
        notes.saveAndFlush(note);

        Notification notification = notifications.saveAndFlush(new Notification(null,
                userId, "conversation.assigned", conversation.getId(), userId, "assigned"));
        AuditLog audit = auditLogs.saveAndFlush(new AuditLog(null, userId, "note.created",
                "note", note.getId(), "127.0.0.1"));

        assertThat(notes.findById(note.getId()).orElseThrow().getMentions()).isEqualTo("[\"user-2\"]");
        assertThat(notifications.findById(notification.getId())).isPresent();
        assertThat(auditLogs.findById(audit.getId())).isPresent();
    }

    @Test
    void routingRulesAndExecutionsRoundTripJsonDocuments() {
        String userId = givenUser("user-rule-1");
        Conversation conversation = conversations.saveAndFlush(
                new Conversation(null, ChannelType.TELEGRAM, "rule-thread"));
        RoutingRule rule = routingRules.saveAndFlush(new RoutingRule(null, "rt-rule", "active", 7,
                "[{\"field\":\"channel\",\"operator\":\"eq\",\"value\":\"telegram\"}]",
                "[{\"type\":\"assign\",\"value\":\"" + userId + "\"}]", userId));
        RoutingRuleExecution execution = routingRuleExecutions.saveAndFlush(
                new RoutingRuleExecution(rule.getId(), conversation.getId(),
                        "[{\"matched\":true}]", "[{\"applied\":true}]"));

        assertThat(routingRules.findById(rule.getId()).orElseThrow().getConditions())
                .contains("telegram");
        assertThat(routingRuleExecutions.findByRuleIdAndConversationId(
                rule.getId(), conversation.getId())).contains(execution);
    }

    @Test
    void deadLetterQueueEntryRoundTripsTracingColumns() {
        Integer profileId = givenIrcProfile();
        Conversation conversation = conversations.saveAndFlush(
                new Conversation(null, ChannelType.IRC, "dlq-thread"));
        Message message = messages.saveAndFlush(new Message(null, conversation.getId(), null,
                "External Sender", "body", MessageDirection.INBOUND));
        DeadLetterQueueEntry entry = new DeadLetterQueueEntry(null, message.getId(),
                conversation.getId(), "{\"payload\":true}", "delivery-failed", 3,
                "last error", LocalDateTime.now().plusDays(7));
        entry.setCorrelationId("corr-1");
        entry.setIrcProfileId(profileId);
        entry.setExternalThreadType("irc");
        entry.setExternalThreadId("#channel");
        entry.setRetryAttempt(false);
        deadLetterQueue.saveAndFlush(entry);

        DeadLetterQueueEntry reloaded = deadLetterQueue.findById(entry.getId()).orElseThrow();
        assertThat(reloaded.getCorrelationId()).isEqualTo("corr-1");
        assertThat(reloaded.getIrcProfileId()).isEqualTo(profileId);
        assertThat(reloaded.getExternalThreadType()).isEqualTo("irc");
        assertThat(reloaded.getTotalAttempts()).isEqualTo(3);
        assertThat(reloaded.getRetryAttempt()).isFalse();
    }

    @Test
    void integrationConfigAndProfileRoundTrip() {
        IntegrationConfig config = integrationConfigs.saveAndFlush(
                new IntegrationConfig("irc", "roundtrip.yacc.local", 6667, "user", "#chan"));
        assertThat(integrationConfigs.findByPlatform("irc")).contains(config);

        IntegrationConnectionProfile profile = integrationProfiles.saveAndFlush(
                new IntegrationConnectionProfile("irc", "roundtrip-profile", "sealed-credentials",
                        "{\"server\":\"roundtrip.yacc.local\"}"));
        IntegrationConnectionProfile reloaded =
                integrationProfiles.findByIntegrationTypeAndName("irc", "roundtrip-profile")
                        .orElseThrow();
        assertThat(reloaded.getEncryptedCredentials()).isEqualTo("sealed-credentials");
        assertThat(reloaded.getTenantId())
                .isEqualTo(IntegrationConnectionProfile.DEFAULT_TENANT_ID);
        assertThat(reloaded.isEnabled()).isTrue();
        assertThat(reloaded.isActive()).isFalse();
        assertThat(profile.getId()).isNotNull();
    }

    /**
     * Exercises the full mutable-column surface of every entity through real
     * JPA update semantics (mutate → flush → reload → assert). Proves every
     * mutable column is writable through the mapping and catches accidental
     * {@code updatable=false} or type mismatches (MIG-021 mapping fidelity).
     */
    @Test
    void everyMutableColumnAcceptsUpdates() {
        LocalDateTime later = LocalDateTime.now().plusDays(1);
        String userId = givenUser("user-mut-1");
        Integer profileId = givenIrcProfile();
        Conversation conversation = conversations.saveAndFlush(
                new Conversation(null, ChannelType.TELEGRAM, "mut-thread"));
        Message message = messages.saveAndFlush(new Message(null, conversation.getId(),
                userId, "Sender", "body", MessageDirection.OUTBOUND));
        Tag tag = tags.saveAndFlush(new Tag("mut-tag", "#111111", userId));
        RoutingRule rule = routingRules.saveAndFlush(new RoutingRule(null, "mut-rule",
                "active", 5, "[]", "[]", userId));
        DeadLetterQueueEntry dlq = deadLetterQueue.saveAndFlush(new DeadLetterQueueEntry(null,
                message.getId(), conversation.getId(), "{}", "reason", 1, "err", later));
        Notification notification = notifications.saveAndFlush(new Notification(null,
                userId, "test.type", null, null, "message"));

        // auth — User
        User user = users.findById(userId).orElseThrow();
        user.setEmail("mutated@fixture.yacc.local");
        user.setName("Mutated");
        user.setPasswordHash("new-hash");
        user.setRole(UserRole.MANAGER);
        user.setStatus(UserStatus.INACTIVE);
        user.setEmailVerified(false);
        user.setImage("https://fixture.yacc.local/a.png");
        user.setLastLoginAt(later);
        user.setDeletedAt(later);
        user.setUpdatedAt(later);
        users.saveAndFlush(user);
        User reloadedUser = users.findById(userId).orElseThrow();
        assertThat(reloadedUser.getEmail()).isEqualTo("mutated@fixture.yacc.local");
        assertThat(reloadedUser.getName()).isEqualTo("Mutated");
        assertThat(reloadedUser.getPasswordHash()).isEqualTo("new-hash");
        assertThat(reloadedUser.getRole()).isEqualTo(UserRole.MANAGER);
        assertThat(reloadedUser.getStatus()).isEqualTo(UserStatus.INACTIVE);
        assertThat(reloadedUser.isEmailVerified()).isFalse();
        assertThat(reloadedUser.getImage()).isEqualTo("https://fixture.yacc.local/a.png");
        assertThat(reloadedUser.getLastLoginAt()).isEqualTo(later);
        assertThat(reloadedUser.getDeletedAt()).isEqualTo(later);

        // auth — Account
        Account account = accounts.saveAndFlush(new Account("acct-mut", userId,
                "mutated@fixture.yacc.local", "credential"));
        account.setAccountId("new-account-id");
        account.setProviderId("oidc");
        account.setAccessToken("at");
        account.setRefreshToken("rt");
        account.setExpiresAt(later);
        account.setUpdatedAt(later);
        accounts.saveAndFlush(account);
        Account reloadedAccount = accounts.findById("acct-mut").orElseThrow();
        assertThat(reloadedAccount.getAccountId()).isEqualTo("new-account-id");
        assertThat(reloadedAccount.getProviderId()).isEqualTo("oidc");
        assertThat(reloadedAccount.getAccessToken()).isEqualTo("at");
        assertThat(reloadedAccount.getRefreshToken()).isEqualTo("rt");
        assertThat(reloadedAccount.getExpiresAt()).isEqualTo(later);

        // auth — Session
        Session session = sessions.saveAndFlush(new Session("sess-mut", userId, later, "t1"));
        session.setExpiresAt(later.plusHours(1));
        session.setToken("t2");
        session.setIpAddress("10.0.0.1");
        session.setUserAgent("fixture-agent");
        session.setUpdatedAt(later);
        sessions.saveAndFlush(session);
        Session reloadedSession = sessions.findById("sess-mut").orElseThrow();
        assertThat(reloadedSession.getToken()).isEqualTo("t2");
        assertThat(reloadedSession.getIpAddress()).isEqualTo("10.0.0.1");
        assertThat(reloadedSession.getUserAgent()).isEqualTo("fixture-agent");
        assertThat(reloadedSession.getExpiresAt()).isEqualTo(later.plusHours(1));

        // auth — Verification
        Verification verification = verifications.saveAndFlush(
                new Verification("ver-mut", "a@fixture.yacc.local", "v1", later));
        verification.setIdentifier("b@fixture.yacc.local");
        verification.setValue("v2");
        verification.setExpiresAt(later.plusHours(2));
        verification.setUpdatedAt(later);
        verifications.saveAndFlush(verification);
        Verification reloadedVerification = verifications.findById("ver-mut").orElseThrow();
        assertThat(reloadedVerification.getIdentifier()).isEqualTo("b@fixture.yacc.local");
        assertThat(reloadedVerification.getValue()).isEqualTo("v2");
        assertThat(reloadedVerification.getExpiresAt()).isEqualTo(later.plusHours(2));

        // auth — PasswordResetToken
        PasswordResetToken reset = passwordResetTokens.saveAndFlush(
                new PasswordResetToken(userId, "rt-1", later));
        reset.setToken("rt-2");
        reset.setExpiresAt(later.plusHours(1));
        reset.setUsedAt(later);
        passwordResetTokens.saveAndFlush(reset);
        PasswordResetToken reloadedReset = passwordResetTokens.findById(reset.getId()).orElseThrow();
        assertThat(reloadedReset.getToken()).isEqualTo("rt-2");
        assertThat(reloadedReset.getUsedAt()).isEqualTo(later);

        // conversation
        conversation.setTitle("Mutated Title");
        conversation.setStatus(ConversationStatus.RESOLVED);
        conversation.setPriority(ConversationPriority.LOW);
        conversation.setIrcProfileId(profileId);
        conversation.setMetadata("{\"mutated\":true}");
        conversation.setUpdatedAt(later);
        conversation.setLastActivityAt(later);
        conversations.saveAndFlush(conversation);
        Conversation reloadedConversation = conversations.findById(conversation.getId()).orElseThrow();
        assertThat(reloadedConversation.getTitle()).isEqualTo("Mutated Title");
        assertThat(reloadedConversation.getStatus()).isEqualTo(ConversationStatus.RESOLVED);
        assertThat(reloadedConversation.getPriority()).isEqualTo(ConversationPriority.LOW);
        assertThat(reloadedConversation.getIrcProfileId()).isEqualTo(profileId);
        assertThat(reloadedConversation.getMetadata()).isEqualTo("{\"mutated\":true}");
        assertThat(reloadedConversation.getLastActivityAt()).isEqualTo(later);

        // message
        message.setSenderName("New Name");
        message.setBody("new body");
        message.setStatus(MessageStatus.SENT);
        message.setExternalMessageId("ext-1");
        message.setMetadata("{\"m\":1}");
        message.setUpdatedAt(later);
        messages.saveAndFlush(message);
        Message reloadedMessage = messages.findById(message.getId()).orElseThrow();
        assertThat(reloadedMessage.getSenderName()).isEqualTo("New Name");
        assertThat(reloadedMessage.getBody()).isEqualTo("new body");
        assertThat(reloadedMessage.getStatus()).isEqualTo(MessageStatus.SENT);
        assertThat(reloadedMessage.getExternalMessageId()).isEqualTo("ext-1");
        assertThat(reloadedMessage.getMetadata()).isEqualTo("{\"m\":1}");

        // attachment
        Attachment attachment = attachments.saveAndFlush(new Attachment(null,
                message.getId(), "old.png", "image/png", 1, "k", "https://fixture.yacc.local/old.png"));
        attachment.setName("new.png");
        attachment.setUrl("https://fixture.yacc.local/new.png");
        attachments.saveAndFlush(attachment);
        Attachment reloadedAttachment = attachments.findById(attachment.getId()).orElseThrow();
        assertThat(reloadedAttachment.getName()).isEqualTo("new.png");
        assertThat(reloadedAttachment.getUrl()).isEqualTo("https://fixture.yacc.local/new.png");

        // raw payload
        RawPayload payload = rawPayloads.saveAndFlush(new RawPayload(message.getId(),
                "telegram", "{}", later));
        payload.setStorageKey("fixture/key.json");
        payload.setExpiresAt(later.plusDays(1));
        rawPayloads.saveAndFlush(payload);
        RawPayload reloadedPayload = rawPayloads.findById(payload.getId()).orElseThrow();
        assertThat(reloadedPayload.getStorageKey()).isEqualTo("fixture/key.json");
        assertThat(reloadedPayload.getExpiresAt()).isEqualTo(later.plusDays(1));

        // note
        Note note = notes.saveAndFlush(new Note(null, conversation.getId(), userId, "body"));
        note.setBody("new body");
        note.setMentions("[\"user\"]");
        note.setUpdatedAt(later);
        notes.saveAndFlush(note);
        Note reloadedNote = notes.findById(note.getId()).orElseThrow();
        assertThat(reloadedNote.getBody()).isEqualTo("new body");
        assertThat(reloadedNote.getMentions()).isEqualTo("[\"user\"]");

        // tag
        tag.setName("mut-tag-2");
        tag.setColor("#222222");
        tags.saveAndFlush(tag);
        Tag reloadedTag = tags.findById(tag.getId()).orElseThrow();
        assertThat(reloadedTag.getName()).isEqualTo("mut-tag-2");
        assertThat(reloadedTag.getColor()).isEqualTo("#222222");

        // routing rule + execution
        rule.setDescription("desc");
        rule.setStatus("disabled");
        rule.setPriority(9);
        rule.setConditions("[{\"mutated\":true}]");
        rule.setActions("[{\"type\":\"priority\",\"value\":\"low\"}]");
        rule.setLastRunAt(later);
        rule.setUpdatedAt(later);
        routingRules.saveAndFlush(rule);
        RoutingRule reloadedRule = routingRules.findById(rule.getId()).orElseThrow();
        assertThat(reloadedRule.getDescription()).isEqualTo("desc");
        assertThat(reloadedRule.getStatus()).isEqualTo("disabled");
        assertThat(reloadedRule.getPriority()).isEqualTo(9);
        assertThat(reloadedRule.getConditions()).isEqualTo("[{\"mutated\":true}]");
        assertThat(reloadedRule.getLastRunAt()).isEqualTo(later);

        RoutingRuleExecution execution = routingRuleExecutions.saveAndFlush(
                new RoutingRuleExecution(rule.getId(), conversation.getId(), "[]", "[]"));
        execution.setMatchedConditions("[{\"m\":1}]");
        execution.setAppliedActions("[{\"a\":1}]");
        routingRuleExecutions.saveAndFlush(execution);
        RoutingRuleExecution reloadedExecution =
                routingRuleExecutions.findById(execution.getId()).orElseThrow();
        assertThat(reloadedExecution.getMatchedConditions()).isEqualTo("[{\"m\":1}]");
        assertThat(reloadedExecution.getAppliedActions()).isEqualTo("[{\"a\":1}]");

        // notification
        notification.setMessage("updated message");
        notification.setRead(true);
        notification.setMetadata("{\"n\":1}");
        notifications.saveAndFlush(notification);
        Notification reloadedNotification = notifications.findById(notification.getId()).orElseThrow();
        assertThat(reloadedNotification.getMessage()).isEqualTo("updated message");
        assertThat(reloadedNotification.isRead()).isTrue();
        assertThat(reloadedNotification.getMetadata()).isEqualTo("{\"n\":1}");

        // audit log
        AuditLog audit = auditLogs.saveAndFlush(new AuditLog(null, userId, "action",
                "note", note.getId(), null));
        audit.setMetadata("{\"a\":1}");
        audit.setIpAddress("10.0.0.2");
        auditLogs.saveAndFlush(audit);
        AuditLog reloadedAudit = auditLogs.findById(audit.getId()).orElseThrow();
        assertThat(reloadedAudit.getMetadata()).isEqualTo("{\"a\":1}");
        assertThat(reloadedAudit.getIpAddress()).isEqualTo("10.0.0.2");

        // DLQ entry
        dlq.setCorrelationId("corr-mut");
        dlq.setExternalThreadType("telegram");
        dlq.setExternalThreadId("ext-thread");
        dlq.setFailureReason("mutated-reason");
        dlq.setLastError("mutated-error");
        dlq.setExpiresAt(later.plusDays(2));
        dlq.setRetryAttempt(true);
        dlq.setRetriedAt(later);
        dlq.setRetriedBy(UUID.fromString("00000000-0000-0000-0000-00000000aa02"));
        dlq.setMetadata("{\"d\":1}");
        dlq.setUpdatedAt(later);
        deadLetterQueue.saveAndFlush(dlq);
        DeadLetterQueueEntry reloadedDlq = deadLetterQueue.findById(dlq.getId()).orElseThrow();
        assertThat(reloadedDlq.getCorrelationId()).isEqualTo("corr-mut");
        assertThat(reloadedDlq.getExternalThreadType()).isEqualTo("telegram");
        assertThat(reloadedDlq.getFailureReason()).isEqualTo("mutated-reason");
        assertThat(reloadedDlq.getLastError()).isEqualTo("mutated-error");
        assertThat(reloadedDlq.getRetryAttempt()).isTrue();
        assertThat(reloadedDlq.getRetriedAt()).isEqualTo(later);
        assertThat(reloadedDlq.getRetriedBy())
                .isEqualTo(UUID.fromString("00000000-0000-0000-0000-00000000aa02"));
        assertThat(reloadedDlq.getMetadata()).isEqualTo("{\"d\":1}");

        // integration config + connection profile
        IntegrationConfig config = integrationConfigs.saveAndFlush(
                new IntegrationConfig("irc", "mut.yacc.local", 6667, "user", "#chan"));
        config.setServer("mut2.yacc.local");
        config.setPort(6697);
        config.setUsername("user2");
        config.setChannels("#chan2");
        config.setUpdatedById(userId);
        config.setUpdatedAt(later);
        integrationConfigs.saveAndFlush(config);
        IntegrationConfig reloadedConfig = integrationConfigs.findById(config.getId()).orElseThrow();
        assertThat(reloadedConfig.getServer()).isEqualTo("mut2.yacc.local");
        assertThat(reloadedConfig.getPort()).isEqualTo(6697);
        assertThat(reloadedConfig.getUsername()).isEqualTo("user2");
        assertThat(reloadedConfig.getChannels()).isEqualTo("#chan2");
        assertThat(reloadedConfig.getUpdatedById()).isEqualTo(userId);
        assertThat(reloadedConfig.isHasPassword()).isFalse();

        IntegrationConnectionProfile profile = integrationProfiles.saveAndFlush(
                new IntegrationConnectionProfile("irc", "mut-profile", "sealed", "{}"));
        profile.setName("mut-profile-2");
        profile.setEnabled(false);
        profile.setEncryptedCredentials("sealed-2");
        profile.setConfig("{\"m\":1}");
        profile.setCreatedById(userId);
        profile.setUpdatedById(userId);
        profile.setLastTestedAt(later);
        profile.setLastTestPassed(true);
        profile.setUpdatedAt(later);
        integrationProfiles.saveAndFlush(profile);
        IntegrationConnectionProfile reloadedProfile =
                integrationProfiles.findById(profile.getId()).orElseThrow();
        assertThat(reloadedProfile.getName()).isEqualTo("mut-profile-2");
        assertThat(reloadedProfile.isEnabled()).isFalse();
        assertThat(reloadedProfile.getEncryptedCredentials()).isEqualTo("sealed-2");
        assertThat(reloadedProfile.getConfig()).isEqualTo("{\"m\":1}");
        assertThat(reloadedProfile.getCreatedById()).isEqualTo(userId);
        assertThat(reloadedProfile.getLastTestedAt()).isEqualTo(later);
        assertThat(reloadedProfile.getLastTestPassed()).isTrue();
    }
}
