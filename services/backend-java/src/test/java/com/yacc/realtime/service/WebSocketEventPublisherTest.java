package com.yacc.realtime.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.time.Instant;
import java.time.format.DateTimeParseException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.yacc.realtime.model.RealtimeRooms;
import com.yacc.realtime.model.RealtimeSession;
import com.yacc.realtime.model.WebSocketEnvelope;

/**
 * Unit tests for the single server→client emit path (MIG-050;
 * WS-BHV-001..003/005): the {@code {event,data,timestamp}} envelope
 * preserved verbatim on every emission, room-targeted delivery, the global
 * broadcast, and the never-break-the-emitter swallow contract.
 */
class WebSocketEventPublisherTest {

    private WebSocketSessionRegistry registry;
    private WebSocketEventPublisher publisher;
    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        registry = new WebSocketSessionRegistry();
        mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
        publisher = new WebSocketEventPublisher(registry, mapper);
    }

    private WebSocketSession connectedSession(String sessionId, String userId) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(sessionId);
        registry.register(new RealtimeSession(sessionId, userId,
                userId + "@fixture.yacc.local", "user", "Fixture"), session);
        registry.joinRoom(sessionId, RealtimeRooms.user(userId));
        return session;
    }

    private JsonNode firstEnvelopeOf(WebSocketSession session) throws Exception {
        ArgumentCaptor<TextMessage> captor = ArgumentCaptor.forClass(TextMessage.class);
        verify(session, atLeastOnce()).sendMessage(captor.capture());
        return mapper.readTree(captor.getValue().getPayload());
    }

    @Test
    void publishToRoomCarriesTheVerbatimEnvelope() throws Exception {
        WebSocketSession member = connectedSession("s1", "user-1");

        publisher.publishToRoom(RealtimeRooms.user("user-1"),
                WebSocketEnvelope.of("notification.received",
                        mapper.createObjectNode().put("id", "n-1")));

        JsonNode envelope = firstEnvelopeOf(member);
        assertThat(envelope.get("event").asText()).isEqualTo("notification.received");
        assertThat(envelope.get("data").get("id").asText()).isEqualTo("n-1");
        assertThat(isIso8601(envelope.get("timestamp").asText())).isTrue();
        assertThat(envelope.fieldNames())
                .toIterable()
                .containsExactlyInAnyOrder("event", "data", "timestamp");
    }

    @Test
    void roomEmissionReachesOnlyRoomMembers() throws Exception {
        WebSocketSession member = connectedSession("s1", "user-1");
        WebSocketSession outsider = connectedSession("s2", "user-2");
        registry.joinRoom("s1", RealtimeRooms.conversation("conv-1"));

        publisher.publishToRoom(RealtimeRooms.conversation("conv-1"),
                WebSocketEnvelope.of("message.sent",
                        mapper.createObjectNode().put("messageId", "m-1")));

        JsonNode envelope = firstEnvelopeOf(member);
        assertThat(envelope.get("event").asText()).isEqualTo("message.sent");
        verify(outsider, never()).sendMessage(any(TextMessage.class));
    }

    @Test
    void publishToSessionTargetsExactlyOneChannel() throws Exception {
        WebSocketSession target = connectedSession("s1", "user-1");
        WebSocketSession bystander = connectedSession("s2", "user-2");

        publisher.publishToSession(target, WebSocketEnvelope.of(
                "system.connection.established",
                mapper.createObjectNode().put("type", "connection_established")));

        verify(target, times(1)).sendMessage(any(TextMessage.class));
        verify(bystander, never()).sendMessage(any(TextMessage.class));
    }

    @Test
    void publishToAllReachesEveryConnectedSession() throws Exception {
        WebSocketSession first = connectedSession("s1", "user-1");
        WebSocketSession second = connectedSession("s2", "user-2");

        publisher.publishToAll(WebSocketEnvelope.of("queue.message.dlq",
                mapper.createObjectNode().put("jobId", "j-1")));

        assertThat(firstEnvelopeOf(first).get("event").asText())
                .isEqualTo("queue.message.dlq");
        assertThat(firstEnvelopeOf(second).get("event").asText())
                .isEqualTo("queue.message.dlq");
    }

    @Test
    void emptyRoomsDeliverNothing() throws Exception {
        WebSocketSession session = connectedSession("s1", "user-1");

        publisher.publishToRoom(RealtimeRooms.conversation("nobody-joins"),
                WebSocketEnvelope.of("message.sent", mapper.createObjectNode()));

        verify(session, never()).sendMessage(any(TextMessage.class));
    }

    @Test
    void sendFailureIsSwallowedSoTheEmittingFlowNeverBreaks() throws Exception {
        WebSocketSession broken = connectedSession("s1", "user-1");
        WebSocketSession healthy = connectedSession("s2", "user-2");
        doThrow(new IOException("gone")).when(broken).sendMessage(any(TextMessage.class));

        publisher.publishToAll(WebSocketEnvelope.of("system.heartbeat",
                mapper.createObjectNode()));

        assertThat(registry.channel("s1")).isPresent(); // session untouched
        verify(healthy, times(1)).sendMessage(any(TextMessage.class));
    }

    private static boolean isIso8601(String value) {
        try {
            Instant.parse(value);
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }
}
