package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.yacc.api.realtime.RealtimeEvents;
import com.yacc.api.realtime.RealtimeRooms;
import com.yacc.api.realtime.RealtimeSession;
import com.yacc.api.realtime.WebSocketEnvelope;

/**
 * Unit tests for the raw WebSocket transport handler (MIG-050; ADR-026):
 * connect-time registration + the ONE {@code system.connection.established}
 * emit (WS-OP-CONV-001/WS-EVT-014), room-subscription channels with
 * enveloped acks (WS-OP-CONV-004/005, WS-OP-CONN-003/004), the centralized
 * {@code system.error} path (WS-BHV-017/WS-EVT-018), and disconnect cleanup
 * (WS-OP-CONV-002 transport half).
 */
class YaccWebSocketHandlerTest {

    private static final RealtimeSession HANDSHAKE = new RealtimeSession(null, "user-1",
            "user-1@fixture.yacc.local", "user", "Fixture user-1");

    private WebSocketSessionRegistry registry;
    private YaccWebSocketHandler handler;
    private ObjectMapper mapper;

    private WebSocketSession session;
    private final Map<String, Object> attributes = new HashMap<>();
    private final List<TextMessage> sent = new CopyOnWriteArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        registry = new WebSocketSessionRegistry();
        mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
        WebSocketEventPublisher publisher = new WebSocketEventPublisher(registry,
                org.mockito.Mockito.mock(WebSocketBacklogService.class), mapper);
        handler = new YaccWebSocketHandler(registry,
                publisher,
                org.mockito.Mockito.mock(WebSocketPresenceService.class),
                org.mockito.Mockito.mock(WebSocketTypingService.class),
                org.mockito.Mockito.mock(WebSocketReconnectService.class),
                org.mockito.Mockito.mock(ConnectorRelayService.class),
                new ApplicationEventRelayService(publisher, mapper),
                mapper);

        session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("s1");
        when(session.getAttributes()).thenReturn(attributes);
        org.mockito.Mockito.doAnswer(invocation -> {
            sent.add(invocation.getArgument(0));
            return null;
        }).when(session).sendMessage(any(TextMessage.class));

        attributes.put(WebSocketHandshakeAuthInterceptor.IDENTITY_ATTRIBUTE, HANDSHAKE);
    }

    private List<JsonNode> envelopes() throws Exception {
        List<JsonNode> nodes = new CopyOnWriteArrayList<>();
        for (TextMessage message : sent) {
            nodes.add(mapper.readTree(message.getPayload()));
        }
        return nodes;
    }

    private JsonNode soleEnvelope() throws Exception {
        List<JsonNode> nodes = envelopes();
        assertThat(nodes).hasSize(1);
        return nodes.get(0);
    }

    private void inbound(String payload) {
        handler.handleTextMessage(session, new TextMessage(payload));
    }

    @Test
    void connectionRegistersJoinsUserRoomAndEmitsExactlyOneEstablishedFrame()
            throws Exception {
        handler.afterConnectionEstablished(session);

        assertThat(registry.channel("s1")).isPresent();
        assertThat(registry.identity("s1")).hasValueSatisfying(identity -> {
            assertThat(identity.sessionId()).isEqualTo("s1");
            assertThat(identity.userId()).isEqualTo("user-1");
            assertThat(identity.role()).isEqualTo("user");
        });
        assertThat(registry.channelsInRoom(RealtimeRooms.user("user-1"))).hasSize(1);

        JsonNode envelope = soleEnvelope();
        assertThat(envelope.get("event").asText())
                .isEqualTo(RealtimeEvents.SYSTEM_CONNECTION_ESTABLISHED);
        assertThat(envelope.get("data").get("type").asText())
                .isEqualTo("connection_established");
        assertThat(envelope.get("timestamp").asText()).isNotEmpty();
    }

    @Test
    void connectionWithoutHandshakeIdentityFailsClosed() throws Exception {
        attributes.clear();

        assertThatThrownBy(() -> handler.afterConnectionEstablished(session))
                .isInstanceOf(IllegalStateException.class);
        assertThat(registry.channel("s1")).isEmpty();
        verify(session, never()).sendMessage(any(TextMessage.class));
    }

    @Test
    void subscribeConversationJoinsRoomAndAcks() throws Exception {
        handler.afterConnectionEstablished(session);
        sent.clear();

        inbound("{\"event\":\"subscribe.conversation\",\"data\":\"conv-1\"}");

        assertThat(registry.channelsInRoom(RealtimeRooms.conversation("conv-1")))
                .hasSize(1);
        JsonNode ack = soleEnvelope();
        assertThat(ack.get("event").asText())
                .isEqualTo(RealtimeEvents.CONVERSATION_SUBSCRIBED);
        assertThat(ack.get("data").get("conversationId").asText()).isEqualTo("conv-1");
    }

    @Test
    void unsubscribeConversationLeavesRoomAndAcks() throws Exception {
        handler.afterConnectionEstablished(session);
        registry.joinRoom("s1", RealtimeRooms.conversation("conv-1"));
        sent.clear();

        inbound("{\"event\":\"unsubscribe.conversation\",\"data\":\"conv-1\"}");

        assertThat(registry.channelsInRoom(RealtimeRooms.conversation("conv-1")))
                .isEmpty();
        JsonNode ack = soleEnvelope();
        assertThat(ack.get("event").asText())
                .isEqualTo(RealtimeEvents.CONVERSATION_UNSUBSCRIBED);
        assertThat(ack.get("data").get("conversationId").asText()).isEqualTo("conv-1");
    }

    @Test
    void connectorSubscribeAndUnsubscribeJoinAndLeaveWithAcks() throws Exception {
        handler.afterConnectionEstablished(session);
        sent.clear();

        inbound("{\"event\":\"connector.subscribe\",\"data\":{\"platform\":\"telegram\"}}");

        assertThat(registry.channelsInRoom(RealtimeRooms.connector("telegram")))
                .hasSize(1);
        JsonNode subscribed = envelopes().get(0);
        assertThat(subscribed.get("event").asText())
                .isEqualTo(RealtimeEvents.CONNECTOR_SUBSCRIBED);
        assertThat(subscribed.get("data").get("platform").asText()).isEqualTo("telegram");
        assertThat(subscribed.get("data").get("timestamp").asText()).isNotEmpty();

        sent.clear();
        inbound("{\"event\":\"connector.unsubscribe\",\"data\":{\"platform\":\"telegram\"}}");

        assertThat(registry.channelsInRoom(RealtimeRooms.connector("telegram")))
                .isEmpty();
        JsonNode unsubscribed = soleEnvelope();
        assertThat(unsubscribed.get("event").asText())
                .isEqualTo(RealtimeEvents.CONNECTOR_UNSUBSCRIBED);
        assertThat(unsubscribed.get("data").get("platform").asText()).isEqualTo("telegram");
    }

    @Test
    void unknownPlatformAndNonStringConversationPayloadsAreBadFrames() throws Exception {
        handler.afterConnectionEstablished(session);
        sent.clear();

        inbound("{\"event\":\"connector.subscribe\",\"data\":{\"platform\":\"slack\"}}");
        inbound("{\"event\":\"subscribe.conversation\",\"data\":{\"id\":\"conv-1\"}}");

        List<JsonNode> nodes = envelopes();
        assertThat(nodes).hasSize(2);
        assertThat(nodes.get(0).get("event").asText()).isEqualTo(RealtimeEvents.SYSTEM_ERROR);
        assertThat(nodes.get(0).get("data").get("error").get("code").asText())
                .isEqualTo(YaccWebSocketHandler.ERROR_CODE_BAD_FRAME);
        assertThat(nodes.get(1).get("data").get("error").get("code").asText())
                .isEqualTo(YaccWebSocketHandler.ERROR_CODE_BAD_FRAME);
        assertThat(registry.channelsInRoom(RealtimeRooms.connector("slack"))).isEmpty();
    }

    @Test
    void unknownEventEmitsSystemErrorToTheFailingSession() throws Exception {
        handler.afterConnectionEstablished(session);
        sent.clear();

        inbound("{\"event\":\"totally.unknown.event\",\"data\":{}}");

        JsonNode envelope = soleEnvelope();
        assertThat(envelope.get("event").asText()).isEqualTo(RealtimeEvents.SYSTEM_ERROR);
        assertThat(envelope.get("data").get("type").asText()).isEqualTo("error");
        assertThat(envelope.get("data").get("error").get("code").asText())
                .isEqualTo(YaccWebSocketHandler.ERROR_CODE_UNKNOWN_EVENT);
    }

    // --- MIG-091a: the nine frozen inbound application operations ---

    @Test
    void conversationUpdatedMessageSentAndMessageFailedFanOutToTheRoomExceptTheSender()
            throws Exception {
        handler.afterConnectionEstablished(session);
        WebSocketSession peer = peerInConversation("00000000-0000-4000-8000-0000000000c1");
        List<TextMessage> peerSent = peerFrames(peer);
        sent.clear();

        inbound("{\"event\":\"conversation.updated\",\"data\":{"
                + "\"conversationId\":\"00000000-0000-4000-8000-0000000000c1\","
                + "\"updatedFields\":{\"status\":\"open\"},"
                + "\"changedBy\":\"00000000-0000-4000-8000-0000000000a1\","
                + "\"changedAt\":\"2026-10-21T08:00:00.000Z\"}}");
        inbound("{\"event\":\"message.sent\",\"data\":{"
                + "\"messageId\":\"00000000-0000-4000-8000-0000000000d1\","
                + "\"conversationId\":\"00000000-0000-4000-8000-0000000000c1\","
                + "\"status\":\"sent\","
                + "\"sentAt\":\"2026-10-21T08:00:01.000Z\"}}");
        inbound("{\"event\":\"message.failed\",\"data\":{"
                + "\"messageId\":\"00000000-0000-4000-8000-0000000000d2\","
                + "\"conversationId\":\"00000000-0000-4000-8000-0000000000c1\","
                + "\"status\":\"failed\","
                + "\"error\":\"NETWORK_ERROR\","
                + "\"retryAt\":\"2026-10-21T08:00:02.000Z\",\"attempt\":1}}");

        // The sender receives nothing; the peer receives the three payloads
        // verbatim (baseline socket.to(room).emit parity).
        assertThat(sent).isEmpty();
        List<JsonNode> peerEnvelopes = envelopesOf(peerSent);
        assertThat(peerEnvelopes).hasSize(3);
        assertThat(peerEnvelopes.get(0).get("event").asText())
                .isEqualTo(RealtimeEvents.CONVERSATION_UPDATED);
        assertThat(peerEnvelopes.get(0).get("data").get("updatedFields").get("status").asText())
                .isEqualTo("open");
        assertThat(peerEnvelopes.get(1).get("event").asText())
                .isEqualTo(RealtimeEvents.MESSAGE_SENT);
        assertThat(peerEnvelopes.get(1).get("data").get("status").asText()).isEqualTo("sent");
        assertThat(peerEnvelopes.get(2).get("event").asText())
                .isEqualTo(RealtimeEvents.MESSAGE_FAILED);
        assertThat(peerEnvelopes.get(2).get("data").get("attempt").asInt()).isEqualTo(1);
    }

    @Test
    void messageRetryAcksTheSenderAndBroadcastsStartedToTheRoom() throws Exception {
        handler.afterConnectionEstablished(session);
        WebSocketSession peer = peerInConversation("00000000-0000-4000-8000-0000000000c1");
        List<TextMessage> peerSent = peerFrames(peer);
        sent.clear();

        inbound("{\"event\":\"message.retry\",\"data\":{"
                + "\"messageId\":\"00000000-0000-4000-8000-0000000000m1\","
                + "\"conversationId\":\"00000000-0000-4000-8000-0000000000c1\"}}");

        // Sender ack (exact frozen shape), then room broadcast except sender.
        JsonNode ack = soleEnvelope();
        assertThat(ack.get("event").asText())
                .isEqualTo(RealtimeEvents.MESSAGE_RETRY_ACKNOWLEDGED);
        assertThat(ack.get("data").fieldNames())
                .toIterable().containsExactly("messageId", "timestamp");
        assertThat(ack.get("data").get("messageId").asText())
                .isEqualTo("00000000-0000-4000-8000-0000000000m1");
        assertThat(ack.get("data").get("timestamp").asText()).isNotEmpty();

        List<JsonNode> peerEnvelopes = envelopesOf(peerSent);
        assertThat(peerEnvelopes).hasSize(1);
        assertThat(peerEnvelopes.get(0).get("event").asText())
                .isEqualTo(RealtimeEvents.MESSAGE_RETRY_STARTED);
        assertThat(peerEnvelopes.get(0).get("data").fieldNames())
                .toIterable().containsExactly("messageId", "conversationId", "timestamp");
        assertThat(peerEnvelopes.get(0).get("data").get("timestamp").asText()).isNotEmpty();
    }

    @Test
    void messageReceivedAckStaysSilentEvenWhenMalformed() throws Exception {
        handler.afterConnectionEstablished(session);
        sent.clear();

        inbound("{\"event\":\"message.received.ack\",\"data\":{"
                + "\"messageId\":\"00000000-0000-4000-8000-0000000000m1\","
                + "\"conversationId\":\"00000000-0000-4000-8000-0000000000c1\"}}");
        inbound("{\"event\":\"message.received.ack\",\"data\":{}}");

        assertThat(sent).isEmpty(); // no emission, no error reply (WS-OP-MSG-004)
    }

    @Test
    void reactionAddedAndRemovedFanOutToTheRoomAndAckTheSender() throws Exception {
        handler.afterConnectionEstablished(session);
        WebSocketSession peer = peerInConversation("00000000-0000-4000-8000-0000000000c1");
        List<TextMessage> peerSent = peerFrames(peer);
        sent.clear();

        inbound("{\"event\":\"reaction.added\",\"data\":{"
                + "\"messageId\":\"00000000-0000-4000-8000-0000000000d1\","
                + "\"conversationId\":\"00000000-0000-4000-8000-0000000000c1\","
                + "\"emoji\":\"👍\","
                + "\"userId\":\"00000000-0000-4000-8000-0000000000a1\","
                + "\"name\":\"Fixture user-1\"}}");
        inbound("{\"event\":\"reaction.removed\",\"data\":{"
                + "\"messageId\":\"00000000-0000-4000-8000-0000000000d1\","
                + "\"conversationId\":\"00000000-0000-4000-8000-0000000000c1\","
                + "\"emoji\":\"👍\","
                + "\"userId\":\"00000000-0000-4000-8000-0000000000a1\"}}");

        List<JsonNode> peerEnvelopes = envelopesOf(peerSent);
        assertThat(peerEnvelopes).hasSize(2);
        assertThat(peerEnvelopes.get(0).get("event").asText())
                .isEqualTo(RealtimeEvents.REACTION_ADDED);
        assertThat(peerEnvelopes.get(0).get("data").get("name").asText())
                .isEqualTo("Fixture user-1");
        assertThat(peerEnvelopes.get(1).get("event").asText())
                .isEqualTo(RealtimeEvents.REACTION_REMOVED);

        List<JsonNode> senderEnvelopes = envelopes();
        assertThat(senderEnvelopes).hasSize(2);
        assertThat(senderEnvelopes.get(0).get("event").asText())
                .isEqualTo(RealtimeEvents.REACTION_ADDED_ACK);
        assertThat(senderEnvelopes.get(0).get("data").fieldNames())
                .toIterable().containsExactly("messageId", "emoji", "timestamp");
        assertThat(senderEnvelopes.get(1).get("event").asText())
                .isEqualTo(RealtimeEvents.REACTION_REMOVED_ACK);
        assertThat(senderEnvelopes.get(1).get("data").fieldNames())
                .toIterable().containsExactly("messageId", "emoji", "timestamp");
    }

    @Test
    void reactionListRepliesWithAnEmptyReactionSet() throws Exception {
        handler.afterConnectionEstablished(session);
        sent.clear();

        inbound("{\"event\":\"reaction.list\",\"data\":{"
                + "\"messageId\":\"00000000-0000-4000-8000-0000000000m1\"}}");

        JsonNode reply = soleEnvelope();
        assertThat(reply.get("event").asText()).isEqualTo(RealtimeEvents.REACTION_LIST_ACK);
        assertThat(reply.get("data").fieldNames())
                .toIterable().containsExactly("messageId", "reactions", "timestamp");
        assertThat(reply.get("data").get("reactions").isArray()).isTrue();
        assertThat(reply.get("data").get("reactions").size()).isZero();
    }

    @Test
    void reactionCountFansOutTheRegeneratedCountPayloadExceptTheSender() throws Exception {
        handler.afterConnectionEstablished(session);
        WebSocketSession peer = peerInConversation("00000000-0000-4000-8000-0000000000c1");
        List<TextMessage> peerSent = peerFrames(peer);
        sent.clear();

        inbound("{\"event\":\"reaction.count\",\"data\":{"
                + "\"messageId\":\"00000000-0000-4000-8000-0000000000m1\","
                + "\"conversationId\":\"00000000-0000-4000-8000-0000000000c1\","
                + "\"emoji\":\"👍\",\"count\":3}}");

        assertThat(sent).isEmpty(); // sender excluded
        List<JsonNode> peerEnvelopes = envelopesOf(peerSent);
        assertThat(peerEnvelopes).hasSize(1);
        assertThat(peerEnvelopes.get(0).get("event").asText())
                .isEqualTo(RealtimeEvents.REACTION_COUNT);
        assertThat(peerEnvelopes.get(0).get("data").fieldNames())
                .toIterable().containsExactly("messageId", "emoji", "count", "timestamp");
        assertThat(peerEnvelopes.get(0).get("data").get("count").asInt()).isEqualTo(3);
    }

    @Test
    void malformedApplicationOperationPayloadsAreBadFramesExceptReceivedAck()
            throws Exception {
        handler.afterConnectionEstablished(session);
        sent.clear();

        inbound("{\"event\":\"conversation.updated\",\"data\":{\"conversationId\":\"c1\"}}");
        inbound("{\"event\":\"message.sent\",\"data\":{"
                + "\"messageId\":\"m1\",\"conversationId\":\"c1\","
                + "\"status\":\"failed\",\"sentAt\":\"2026-10-21T08:00:00.000Z\"}}");
        inbound("{\"event\":\"message.failed\",\"data\":{"
                + "\"messageId\":\"m1\",\"conversationId\":\"c1\","
                + "\"status\":\"failed\",\"error\":\"x\","
                + "\"retryAt\":\"2026-10-21T08:00:00.000Z\",\"attempt\":4}}");
        inbound("{\"event\":\"message.retry\",\"data\":{\"messageId\":\"m1\"}}");
        inbound("{\"event\":\"reaction.added\",\"data\":{"
                + "\"messageId\":\"m1\",\"conversationId\":\"c1\",\"emoji\":\"👍\"}}");
        inbound("{\"event\":\"reaction.removed\",\"data\":{"
                + "\"messageId\":\"m1\",\"conversationId\":\"c1\"}}");
        inbound("{\"event\":\"reaction.list\",\"data\":{}}");
        inbound("{\"event\":\"reaction.count\",\"data\":{"
                + "\"messageId\":\"m1\",\"conversationId\":\"c1\","
                + "\"emoji\":\"👍\",\"count\":1.5}}");
        inbound("{\"event\":\"message.sent\",\"data\":{"
                + "\"messageId\":\"00000000-0000-4000-8000-0000000000d1\","
                + "\"conversationId\":\"00000000-0000-4000-8000-0000000000c1\","
                + "\"status\":\"sent\",\"sentAt\":1739990000}}");

        List<JsonNode> nodes = envelopes();
        assertThat(nodes).hasSize(9);
        for (JsonNode node : nodes) {
            assertThat(node.get("event").asText()).isEqualTo(RealtimeEvents.SYSTEM_ERROR);
            assertThat(node.get("data").get("error").get("code").asText())
                    .isEqualTo(YaccWebSocketHandler.ERROR_CODE_BAD_FRAME);
        }
    }

    @Test
    void malformedFrameAndMissingEventEmitBadFrameErrors() throws Exception {
        handler.afterConnectionEstablished(session);
        sent.clear();

        inbound("not-json-at-all");
        inbound("{\"data\":\"no-event-name\"}");

        List<JsonNode> nodes = envelopes();
        assertThat(nodes).hasSize(2);
        assertThat(nodes.get(0).get("data").get("error").get("code").asText())
                .isEqualTo(YaccWebSocketHandler.ERROR_CODE_BAD_FRAME);
        assertThat(nodes.get(1).get("data").get("error").get("code").asText())
                .isEqualTo(YaccWebSocketHandler.ERROR_CODE_BAD_FRAME);
    }

    @Test
    void framesFromUnregisteredSessionsEmitTheTransportErrorPath() throws Exception {
        // No afterConnectionEstablished — the session was never registered.
        inbound("{\"event\":\"subscribe.conversation\",\"data\":\"conv-1\"}");

        JsonNode envelope = soleEnvelope();
        assertThat(envelope.get("data").get("error").get("code").asText())
                .isEqualTo(YaccWebSocketHandler.ERROR_CODE_TRANSPORT);
        assertThat(registry.channelsInRoom(RealtimeRooms.conversation("conv-1"))).isEmpty();
    }

    @Test
    void transportErrorEmitsSystemErrorAndClosesTheSession() throws Exception {
        handler.afterConnectionEstablished(session);
        sent.clear();

        handler.handleTransportError(session, new RuntimeException("socket broke"));

        JsonNode envelope = soleEnvelope();
        assertThat(envelope.get("event").asText()).isEqualTo(RealtimeEvents.SYSTEM_ERROR);
        assertThat(envelope.get("data").get("error").get("code").asText())
                .isEqualTo(YaccWebSocketHandler.ERROR_CODE_TRANSPORT);
        verify(session).close(CloseStatus.SERVER_ERROR);
    }

    @Test
    void disconnectUnregistersTheSessionAndCleansEveryRoom() {
        handler.afterConnectionEstablished(session);
        registry.joinRoom("s1", RealtimeRooms.conversation("conv-1"));
        registry.joinRoom("s1", RealtimeRooms.connector("irc"));

        handler.afterConnectionClosed(session, CloseStatus.NORMAL);

        assertThat(registry.channel("s1")).isEmpty();
        assertThat(registry.channelsInRoom(RealtimeRooms.user("user-1"))).isEmpty();
        assertThat(registry.channelsInRoom(RealtimeRooms.conversation("conv-1"))).isEmpty();
        assertThat(registry.channelsInRoom(RealtimeRooms.connector("irc"))).isEmpty();
    }

    // --- fan-out peer fixture ---

    /** Registers a second live session (user-2) and joins it to the room. */
    private WebSocketSession peerInConversation(String conversationId) throws Exception {
        WebSocketSession peer = mock(WebSocketSession.class);
        when(peer.getId()).thenReturn("s2");
        when(peer.getAttributes()).thenReturn(new HashMap<>(Map.of(
                WebSocketHandshakeAuthInterceptor.IDENTITY_ATTRIBUTE,
                new RealtimeSession(null, "user-2", "user-2@fixture.yacc.local",
                        "user", "Fixture user-2"))));
        handler.afterConnectionEstablished(peer);
        registry.joinRoom("s2", RealtimeRooms.conversation(conversationId));
        return peer;
    }

    private static List<TextMessage> peerFrames(WebSocketSession peer) throws Exception {
        List<TextMessage> frames = new CopyOnWriteArrayList<>();
        org.mockito.Mockito.doAnswer(invocation -> {
            frames.add(invocation.getArgument(0));
            return null;
        }).when(peer).sendMessage(any(TextMessage.class));
        return frames;
    }

    private List<JsonNode> envelopesOf(List<TextMessage> frames) throws Exception {
        List<JsonNode> nodes = new CopyOnWriteArrayList<>();
        for (TextMessage message : frames) {
            nodes.add(mapper.readTree(message.getPayload()));
        }
        return nodes;
    }
}
