package com.yacc.realtime.service;

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
import com.yacc.realtime.model.RealtimeEvents;
import com.yacc.realtime.model.RealtimeRooms;
import com.yacc.realtime.model.RealtimeSession;
import com.yacc.realtime.model.WebSocketEnvelope;

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
        handler = new YaccWebSocketHandler(registry,
                new WebSocketEventPublisher(registry, mapper), mapper);

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

        inbound("{\"event\":\"message.sent\",\"data\":{}}");

        JsonNode envelope = soleEnvelope();
        assertThat(envelope.get("event").asText()).isEqualTo(RealtimeEvents.SYSTEM_ERROR);
        assertThat(envelope.get("data").get("type").asText()).isEqualTo("error");
        assertThat(envelope.get("data").get("error").get("code").asText())
                .isEqualTo(YaccWebSocketHandler.ERROR_CODE_UNKNOWN_EVENT);
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
}
