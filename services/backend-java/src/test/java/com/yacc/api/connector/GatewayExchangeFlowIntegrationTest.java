package com.yacc.api.connector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.InputStream;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestClient;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import com.yacc.api.auth.AuthUser;
import com.yacc.api.queue.QueueRetryService;
import com.yacc.api.realtime.RealtimeRooms;
import com.yacc.api.realtime.RealtimeEvents;
import com.yacc.api.realtime.WebSocketEnvelope;
import com.yacc.api.realtime.WebSocketEventPublisher;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
import com.yacc.entity.ChannelType;
import com.yacc.entity.Conversation;
import com.yacc.entity.ConversationStatus;
import com.yacc.entity.IntegrationConnectionProfile;
import com.yacc.entity.User;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.repository.AuditLogRepository;
import com.yacc.repository.ConversationRepository;
import com.yacc.repository.DeadLetterQueueEntryRepository;
import com.yacc.repository.MessageRepository;
import com.yacc.repository.UserRepository;
import com.yacc.service.JwtTokenService;

/**
 * MIG-062 gateway-exchange flow over the real PostgreSQL data layer and the
 * real connectors (AC-MIG-062-2/3/4/5; ledger WS-EVT-003/004/005,
 * WS-QEV-001/002): Telegram/IRC inbound ingestion parity (conversation
 * find-or-create + G12 profile identity + auto-reopen + audit +
 * {@code message.received}), the REST 201/PENDING &rarr; async-dispatch
 * round-trip ({@code message.sent}/{@code message.failed} + DLQ + retry
 * cycle), the breaker fail-fast/un-wedge pair with single-sourced failure
 * counting, and the redelivery seam through the merged MIG-063 worker
 * (driven synchronously for determinism — no Quartz threads needed).
 *
 * <p>Deliberately NOT {@code @Transactional}: the dispatch runs on the
 * exchange executor and the worker on the calling thread, so rows must be
 * committed; every test removes exactly its own rows in {@code @AfterEach}
 * (committed-row-writers rule). The Bot API is mocked at the HTTP boundary
 * ({@code MockRestServiceServer}); the IRC transport is the loopback mock
 * server — a real Telegram API or IRC network is never contacted.</p>
 */
@AutoConfigureMockMvc
class GatewayExchangeFlowIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String SUPER_ID = "00000000-0000-0000-0000-00000000e101";
    private static final String SUPER_EMAIL = "exchange-super@fixture.yacc.local";
    private static final String CHAT_ID = "12345";
    private static final String VALID_TOKEN =
            "123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
    private static final String BOT_API = "https://api.telegram.org/bot" + VALID_TOKEN;
    private static final String GET_ME_OK = """
            {"ok":true,"result":{"id":42,"is_bot":true,
             "first_name":"YaccBot","username":"yacc_bot"}}""";
    private static final String SEND_OK = """
            {"ok":true,"result":{"message_id":777}}""";
    private static final Duration WAIT = Duration.ofSeconds(5);

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private ObjectMapper mapper;
    @Autowired
    private UserRepository users;
    @Autowired
    private JwtTokenService jwtTokens;
    @Autowired
    private ConversationRepository conversations;
    @Autowired
    private MessageRepository messages;
    @Autowired
    private DeadLetterQueueEntryRepository dlqEntries;
    @Autowired
    private AuditLogRepository auditLogs;
    @Autowired
    private ConnectorRegistry registry;
    @Autowired
    private ConnectorCircuitBreaker breaker;
    @Autowired
    private ConnectorErrorHook errorHook;
    @Autowired
    private ConnectorStatusListener statusListener;
    @Autowired
    private GatewayExchange exchange;
    @Autowired
    private TelegramConnector telegramConnector;
    @Autowired
    private IrcConnector ircConnector;
    @Autowired
    private QueueRetryService retryQueue;
    @Autowired
    private Scheduler scheduler;
    @Autowired
    private com.yacc.repository.IntegrationConnectionProfileRepository integrationProfiles;
    @Autowired
    private com.yacc.service.EncryptionService encryption;
    @MockitoSpyBean
    private WebSocketEventPublisher publisher;
    @MockitoBean
    private TelegramCredentialsResolver telegramCredentials;

    private MockIrcServer ircServer;

    /**
     * Deterministic Bot API mock: the builder and the bound server are created
     * TOGETHER (Boot's auto-configured builder is prototype-scoped, and the
     * connector builds its client at construction — a server bean created
     * later would bind a different builder instance and let the call escape
     * to the real network).
     */
    @TestConfiguration
    static class BotApiMockConfig {

        record BotApiMock(RestClient.Builder builder, MockRestServiceServer server) {
        }

        @Bean
        BotApiMock botApiMock() {
            RestClient.Builder builder = RestClient.builder();
            return new BotApiMock(builder, MockRestServiceServer.bindTo(builder).build());
        }

        @Bean
        RestClient.Builder restClientBuilder(BotApiMock mock) {
            return mock.builder();
        }

        @Bean
        MockRestServiceServer botApiServer(BotApiMock mock) {
            return mock.server();
        }
    }

    @Autowired
    private MockRestServiceServer botApi;

    @AfterEach
    void cleanCommittedState() throws Exception {
        // Committed-row writers self-clean (MIG-101 rule); FK order:
        // DLQ rows, messages, conversations, integration profiles, audit,
        // this test's own users.
        scheduler.clear();
        dlqEntries.deleteAll();
        messages.deleteAll();
        conversations.deleteAll();
        integrationProfiles.deleteAll();
        auditLogs.deleteAll();
        users.deleteAllById(List.of(SUPER_ID));
        breaker.recordSuccess("telegram");
        breaker.recordSuccess("irc");
        // Reset connector state so a CONNECTED connector never leaks into the
        // next test's dispatch (the Bot API mock has no cross-test memory).
        telegramConnector.disconnect();
        ircConnector.disconnect();
        if (ircServer != null) {
            ircServer.close();
            ircServer = null;
        }
    }

    // --- AC-MIG-062-1: startup registration (context-boot proof) ---

    @Test
    void bothConnectorsAreRegisteredAtStartupAndUnknownPlatformsReportAbsence() {
        assertThat(registry.get("telegram")).isPresent();
        assertThat(registry.get("irc")).isPresent();
        assertThat(registry.platforms()).containsExactlyInAnyOrder("telegram", "irc");
        assertThat(registry.get("slack")).isEmpty();
    }

    // --- AC-MIG-062-2: inbound end-to-end ---

    @Test
    void telegramInboundPersistsConversationMessageAuditAndEmitsReceived() throws Exception {
        seedSuperUser();

        telegramConnector.acceptUpdate(java.util.regex.Matcher.quoteReplacement("""
                {"update_id":1,"message":{"message_id":10,
                 "from":{"id":555,"username":"tguser","first_name":"Tg"},
                 "chat":{"id":%s,"type":"private"},"date":1697000000,
                 "text":"hello from telegram"}}""".formatted(CHAT_ID)));

        Conversation conversation = await(() -> conversations.findAll().stream()
                .filter(candidate -> CHAT_ID.equals(candidate.getExternalThreadId()))
                .findFirst().orElse(null));
        assertThat(conversation.getChannel()).isEqualTo(ChannelType.TELEGRAM);
        assertThat(conversation.getTitle()).isEqualTo(CHAT_ID);
        assertThat(conversation.getStatus()).isEqualTo(ConversationStatus.OPEN);
        assertThat(conversation.getMetadata()).contains("telegram_adapter");
        assertThat(conversation.getLastActivityAt()).isNotNull();

        var message = await(() -> messages.findAll().stream().findFirst().orElse(null));
        assertThat(message.getConversationId()).isEqualTo(conversation.getId());
        assertThat(message.getDirection().getLabel()).isEqualTo("inbound");
        assertThat(message.getStatus().getLabel()).isEqualTo("sent");
        // The V1 sender_id column is a users FK — external identities carry
        // no user row, so the external id rides in the metadata and the wire
        // payload (baseline shape).
        assertThat(message.getSenderId()).isNull();
        assertThat(message.getSenderName()).isEqualTo("tguser");
        assertThat(message.getMetadata()).contains("correlationId");
        assertThat(message.getMetadata()).contains("senderId");

        JsonNode data = awaitReceivedFrame();
        assertThat(data.get("messageId").asText()).isEqualTo(message.getId().toString());
        assertThat(data.get("conversationId").asText())
                .isEqualTo(conversation.getId().toString());
        assertThat(data.get("senderId").asText()).isEqualTo("555");
        validateAgainstFrozenSchema(data, "message-received");

        assertThat(auditLogs.findAll())
                .anySatisfy(row -> {
                    assertThat(row.getAction()).isEqualTo("message.ingested");
                    assertThat(row.getMetadata()).contains("telegram");
                });
    }

    @Test
    void inboundOnAResolvedConversationReopensItWithTheAuditParity() throws Exception {
        seedSuperUser();
        Conversation resolved = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.TELEGRAM, CHAT_ID));
        resolved.setStatus(ConversationStatus.RESOLVED);
        conversations.saveAndFlush(resolved);

        telegramConnector.acceptUpdate("""
                {"update_id":2,"message":{"message_id":11,
                 "from":{"id":555,"username":"tguser"},
                 "chat":{"id":%s,"type":"private"},"date":1697000001,
                 "text":"reopen please"}}""".formatted(CHAT_ID));

        Conversation reopened = await(() -> conversations.findById(resolved.getId())
                .filter(candidate -> candidate.getStatus() == ConversationStatus.OPEN)
                .orElse(null));
        assertThat(reopened.getId()).isEqualTo(resolved.getId());
        assertThat(auditLogs.findAll()).anySatisfy(row -> {
            assertThat(row.getAction()).isEqualTo("conversation_reopened");
            assertThat(row.getMetadata()).contains("inbound_message");
        });
    }

    @Test
    void ircInboundCarriesTheResolvedProfileIdentityAndCreatesTheConversation()
            throws Exception {
        seedSuperUser();
        ircServer = new MockIrcServer();
        ircServer.autoRegister();
        // The real DB-first resolver over a real (active) profile row — the
        // conversation FK on irc_profile_id is real, so the profile is real.
        // The credentials blob is the stored-shape JSON encrypted by the
        // production service (AES-256-GCM); the blank password resolves to
        // null on the resolver side.
        IntegrationConnectionProfile profile = integrationProfiles.save(
                new IntegrationConnectionProfile("irc", "fixture irc profile",
                        encryption.encrypt("{\"password\":\"\"}"),
                        "{\"server\":\"127.0.0.1\",\"port\":" + ircServer.port()
                                + ",\"username\":\"yaccbot\",\"channels\":[\"#test\"]}"));

        ircConnector.connect();
        ircServer.sendLine(":nick!~nick@irc PRIVMSG #test :hello from irc");

        Conversation conversation = await(() -> conversations.findAll().stream()
                .filter(candidate -> "#test".equals(candidate.getExternalThreadId()))
                .findFirst().orElse(null));
        assertThat(conversation.getChannel()).isEqualTo(ChannelType.IRC);
        assertThat(conversation.getIrcProfileId()).isEqualTo(profile.getId());
        assertThat(conversation.getMetadata()).contains("irc_adapter");
        var message = await(() -> messages.findAll().stream().findFirst().orElse(null));
        assertThat(message.getSenderId()).isNull();
        assertThat(message.getMetadata()).contains("senderId");
        JsonNode data = awaitFrame(RealtimeEvents.MESSAGE_RECEIVED,
                frame -> frame.has("platform") && "irc".equals(frame.get("platform").asText()));
        assertThat(data.get("senderId").asText()).isEqualTo("nick");
    }

    @Test
    void malformedInboundFailsClosedWithoutAnyRows() {
        seedSuperUser();

        exchange.onInboundMessage(new IrcInboundMessage("irc", " ", "nick", "nick",
                "hello", java.time.LocalDateTime.now(), UUID.randomUUID(), "raw", 7));

        assertThat(conversations.count()).isZero();
        assertThat(messages.count()).isZero();
    }

    // --- AC-MIG-062-3/5: outbound round-trip + failure accounting ---

    @Test
    void sendReturnsFrozen201PendingThenAsyncDispatchDeliversAndEmits() throws Exception {
        seedSuperUser();
        Conversation conversation = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.TELEGRAM, CHAT_ID));
        // Connect the real connector against the mocked Bot API so the send
        // can succeed (getMe 200 → CONNECTED); the dispatch then answers
        // with the sendMessage 200.
        when(telegramCredentials.resolve()).thenReturn(Optional.of(
                new TelegramCredentials(VALID_TOKEN, "yacc_bot")));
        botApi.expect(requestTo(BOT_API + "/getMe"))
                .andRespond(withSuccess(GET_ME_OK, MediaType.APPLICATION_JSON));
        botApi.expect(requestTo(BOT_API + "/sendMessage"))
                .andRespond(withSuccess(SEND_OK, MediaType.APPLICATION_JSON));
        telegramConnector.connect();

        UUID messageId = sendRestMessage(conversation.getId());

        var message = await(() -> messages.findById(messageId)
                .filter(candidate -> candidate.getStatus().getLabel().equals("sent"))
                .orElse(null));
        assertThat(message.getExternalMessageId()).isEqualTo("777");
        JsonNode sent = awaitFrameFor(RealtimeEvents.MESSAGE_SENT, messageId);
        assertThat(sent.get("messageId").asText()).isEqualTo(messageId.toString());
        assertThat(sent.get("status").asText()).isEqualTo("sent");
        validateAgainstFrozenSchema(sent, "message-sent");
        assertThat(dlqEntries.count()).isZero();
        botApi.verify();
    }

    @Test
    void failedDispatchRecordsFailureDlqRetryCycleAndFrames() throws Exception {
        seedSuperUser();
        Conversation conversation = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.TELEGRAM, CHAT_ID));

        UUID messageId = sendRestMessage(conversation.getId());

        // The real connector is disconnected → the typed retryable send
        // failure surfaces through the hook path (counted once).
        var message = await(() -> messages.findById(messageId)
                .filter(candidate -> candidate.getStatus().getLabel().equals("failed"))
                .orElse(null));
        assertThat(message.getMetadata()).contains("error");
        JsonNode failed = awaitFrameFor(RealtimeEvents.MESSAGE_FAILED, messageId);
        assertThat(failed.get("messageId").asText()).isEqualTo(messageId.toString());
        assertThat(failed.get("attempt").asInt()).isEqualTo(1);
        assertThat(failed.get("retryAt").isTextual()).isTrue();
        validateAgainstFrozenSchema(failed, "message-failed");
        awaitFrame(RealtimeEvents.QUEUE_MESSAGE_DLQ, data -> true);
        JsonNode retryScheduled = awaitFrameFor(RealtimeEvents.MESSAGE_RETRY_SCHEDULED, messageId);
        assertThat(retryScheduled.get("messageId").asText()).isEqualTo(messageId.toString());

        var entry = await(() -> dlqEntries.findByMessageId(messageId).orElse(null));
        assertThat(entry.getConversationId()).isEqualTo(conversation.getId());
        assertThat(entry.getFailureReason()).isEqualTo("SEND_FAILED");
        assertThat(entry.getTotalAttempts()).isEqualTo(1);
        // The automatic path never touches the P0 manual-retry gate (G7):
        // null/absent = not retried (the REST-MSG-003 gate is null-safe).
        assertThat(entry.getRetryAttempt()).isNotEqualTo(Boolean.TRUE);
        await(() -> jobExists(messageId));
    }

    // --- AC-MIG-062-5: breaker fail-fast + single-sourced counting + un-wedge ---

    @Test
    void breakerOpenFailsFastWithoutAConnectorCallAndTheConnectedTransitionUnwedges()
            throws Exception {
        seedSuperUser();
        Conversation conversation = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.TELEGRAM, CHAT_ID));

        // Five surfaced adapter failures through the merged hook path open
        // the platform breaker (threshold 5, MIG-063).
        for (int failure = 0; failure < 5; failure++) {
            errorHook.onAdapterError(new ConnectorAdapterError("telegram", "sendMessage",
                    ConnectorErrorCode.NETWORK_ERROR, "connect timed out", true,
                    java.time.LocalDateTime.now()));
        }
        assertThat(breaker.isOpen("telegram")).isTrue();

        UUID messageId = sendRestMessage(conversation.getId());
        await(() -> messages.findById(messageId)
                .filter(candidate -> candidate.getStatus().getLabel().equals("failed"))
                .orElse(null));
        // Fail fast: the connector was never called (never connected here —
        // zero Bot API traffic), and the exchange added no extra count.
        assertThat(breaker.failureCount("telegram")).isEqualTo(5);
        assertThat(dlqEntries.findByMessageId(messageId)).isPresent();

        // The G6 un-wedge path: connector status → connected resets the
        // counter through the additive seam (the production broadcaster).
        statusListener.onStatusChange("telegram", ConnectorStatus.CONNECTED);
        assertThat(breaker.isOpen("telegram")).isFalse();

        // The next dispatch gets past the breaker (it fails on the
        // disconnected connector — counted once through the hook again).
        UUID second = sendRestMessage(conversation.getId());
        await(() -> messages.findById(second)
                .filter(candidate -> candidate.getStatus().getLabel().equals("failed"))
                .orElse(null));
        assertThat(breaker.failureCount("telegram")).isEqualTo(1);
    }

    // --- AC-MIG-062-4: the redelivery seam through the merged worker ---

    @Test
    void redeliveryDeliverThenClearsTheDlqRowAndDuplicateDeliveryCollapses()
            throws Exception {
        seedSuperUser();
        Conversation conversation = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.TELEGRAM, CHAT_ID));
        UUID messageId = failedDispatch(conversation.getId());

        // The connector reaches CONNECTED against the mocked Bot API.
        when(telegramCredentials.resolve()).thenReturn(Optional.of(
                new TelegramCredentials(VALID_TOKEN, "yacc_bot")));
        botApi.expect(requestTo(BOT_API + "/getMe")).andRespond(withSuccess(GET_ME_OK, MediaType.APPLICATION_JSON));
        botApi.expect(requestTo(BOT_API + "/sendMessage")).andRespond(withSuccess(SEND_OK, MediaType.APPLICATION_JSON));
        telegramConnector.connect();

        retryQueue.executeRetryAttempt(messageId.toString());

        var message = await(() -> messages.findById(messageId)
                .filter(candidate -> candidate.getStatus().getLabel().equals("sent"))
                .orElse(null));
        assertThat(message.getExternalMessageId()).isEqualTo("777");
        await(() -> dlqEntries.findByMessageId(messageId).isEmpty() ? Optional.of(1)
                : Optional.empty());
        JsonNode sent = awaitFrameFor(RealtimeEvents.MESSAGE_SENT, messageId);
        assertThat(sent.get("messageId").asText()).isEqualTo(messageId.toString());

        // Duplicate tolerance: a repeated deliver collapses without a
        // connector call, without status corruption, without a new DLQ row.
        var outcome = exchange.deliver(messageId);
        assertThat(outcome.delivered()).isTrue();
        assertThat(messages.findById(messageId).orElseThrow().getStatus().getLabel())
                .isEqualTo("sent");
        assertThat(dlqEntries.findByMessageId(messageId)).isEmpty();
    }

    @Test
    void exhaustionTerminatesAfterThreeFailedRedeliveriesWithoutATerminalEmission()
            throws Exception {
        seedSuperUser();
        Conversation conversation = conversations.save(new Conversation(UUID.randomUUID(),
                ChannelType.TELEGRAM, CHAT_ID));
        UUID messageId = failedDispatch(conversation.getId());
        long framesAfterInitial = frameCount(RealtimeEvents.MESSAGE_FAILED);

        for (int attempt = 0; attempt < 3; attempt++) {
            retryQueue.executeRetryAttempt(messageId.toString());
        }

        var entry = await(() -> dlqEntries.findByMessageId(messageId)
                .filter(candidate -> candidate.getMetadata() != null
                        && candidate.getMetadata().contains("exhausted"))
                .orElse(null));
        assertThat(entry.getTotalAttempts()).isGreaterThanOrEqualTo(4);
        await(() -> jobExists(messageId).isEmpty());
        // E3 posture: the terminal (exhausted) failure emits no message.failed
        // — attempts 1 (initial), 2 and 3 (redeliveries) were emitted.
        await(() -> frameCount(RealtimeEvents.MESSAGE_FAILED) >= framesAfterInitial + 2
                ? Optional.of(1) : Optional.empty());
        assertThat(frameCount(RealtimeEvents.MESSAGE_FAILED))
                .isEqualTo(framesAfterInitial + 2);
        assertThat(messages.findById(messageId).orElseThrow().getStatus().getLabel())
                .isEqualTo("failed");
    }

    // --- helpers ---

    private Optional<?> jobExists(UUID messageId) {
        try {
            return scheduler.checkExists(org.quartz.JobKey.jobKey(messageId.toString(),
                    QueueRetryService.JOB_GROUP))
                    ? Optional.of(1)
                    : Optional.empty();
        } catch (SchedulerException failure) {
            return Optional.empty();
        }
    }

    private UUID failedDispatch(UUID conversationId) throws Exception {
        UUID messageId = sendRestMessage(conversationId);
        await(() -> messages.findById(messageId)
                .filter(candidate -> candidate.getStatus().getLabel().equals("failed"))
                .orElse(null));
        awaitFrameFor(RealtimeEvents.MESSAGE_RETRY_SCHEDULED, messageId);
        return messageId;
    }

    private UUID sendRestMessage(UUID conversationId) throws Exception {
        String auth = "Bearer " + jwtTokens.issueAccessToken(
                new AuthUser(users.findById(SUPER_ID).orElseThrow()), "test-grant");
        String response = mockMvc.perform(post(
                        "/api/conversations/" + conversationId + "/messages")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.createObjectNode().put("body", "outbound hello")
                                .toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("pending"))
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(mapper.readTree(response).path("data").path("id").asText());
    }

    private void seedSuperUser() {
        users.saveAndFlush(new User(SUPER_ID, SUPER_EMAIL, "Exchange Fixture",
                "no-login-exchange", UserRole.SUPER_ADMIN, UserStatus.ACTIVE, false));
    }

    private long frameCount(String event) {
        ArgumentCaptor<WebSocketEnvelope> captor = ArgumentCaptor
                .forClass(WebSocketEnvelope.class);
        verify(publisher, atLeast(0)).publishToAll(captor.capture());
        verify(publisher, atLeast(0)).publishToRoom(any(), captor.capture());
        return captor.getAllValues().stream()
                .filter(envelope -> event.equals(envelope.event()))
                .count();
    }

    /**
     * The first captured frame of the event matching the data predicate
     * (bounded wait). The spy accumulates captures across the whole class, so
     * every call site narrows by payload (e.g. the message id).
     */
    private JsonNode awaitFrame(String event, java.util.function.Predicate<JsonNode> data)
            throws Exception {
        long deadline = System.currentTimeMillis() + WAIT.toMillis();
        while (System.currentTimeMillis() < deadline) {
            ArgumentCaptor<WebSocketEnvelope> captor = ArgumentCaptor
                    .forClass(WebSocketEnvelope.class);
            verify(publisher, atLeast(0)).publishToAll(captor.capture());
            verify(publisher, atLeast(0)).publishToRoom(any(), captor.capture());
            Optional<WebSocketEnvelope> match = captor.getAllValues().stream()
                    .filter(envelope -> event.equals(envelope.event()))
                    .filter(envelope -> data.test(envelope.data()))
                    .findFirst();
            if (match.isPresent()) {
                return match.get().data();
            }
            Thread.sleep(25);
        }
        throw new AssertionError("no " + event + " frame captured within the timeout");
    }

    private JsonNode awaitReceivedFrame() throws Exception {
        return awaitFrame(RealtimeEvents.MESSAGE_RECEIVED, data -> true);
    }

    private JsonNode awaitFrameFor(String event, UUID messageId) throws Exception {
        return awaitFrame(event, data -> data.has("messageId")
                && messageId.toString().equals(data.get("messageId").asText()));
    }

    private void validateAgainstFrozenSchema(JsonNode data, String name) throws Exception {
        try (InputStream schema = getClass()
                .getResourceAsStream("/contract/schemas/" + name + ".schema.json")) {
            assertThat(schema).as("frozen %s.schema.json on the classpath", name).isNotNull();
            JsonNode node = mapper.readTree(schema);
            ((ObjectNode) node).remove("$id");
            JsonSchema validator = JsonSchemaFactory
                    .getInstance(SpecVersion.VersionFlag.V202012)
                    .getSchema(node, SchemaValidatorsConfig.builder()
                            .formatAssertionsEnabled(Boolean.TRUE).build());
            var violations = validator.validate(data);
            assertThat(violations).as("payload of %s", name).isEmpty();
        }
    }

    private <T> T await(Supplier<T> condition) {
        long deadline = System.currentTimeMillis() + WAIT.toMillis();
        while (System.currentTimeMillis() < deadline) {
            T value = condition.get();
            if (value != null) {
                return value;
            }
            try {
                Thread.sleep(25);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        throw new AssertionError("condition not met within the timeout");
    }
}
