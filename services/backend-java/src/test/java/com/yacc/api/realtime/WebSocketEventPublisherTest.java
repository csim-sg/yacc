package com.yacc.api.realtime;

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
import com.yacc.api.realtime.RealtimeRooms;
import com.yacc.api.realtime.RealtimeSession;
import com.yacc.api.realtime.WebSocketEnvelope;

/**
 * Unit tests for the single server→client emit path (MIG-050;
 * WS-BHV-001..003/005): the {@code {event,data,timestamp}} envelope
 * preserved verbatim on every emission, room-targeted delivery, the global
 * broadcast, and the never-break-the-emitter swallow contract.
 */
class WebSocketEventPublisherTest {

    private WebSocketSessionRegistry registry;
    private WebSocketBacklogService backlog;
    private WebSocketEventPublisher publisher;
    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        registry = new WebSocketSessionRegistry();
        backlog = org.mockito.Mockito.mock(WebSocketBacklogService.class);
        when(backlog.isEligible(any())).thenAnswer(invocation -> WebSocketBacklogService
                .isBaselineEligibleEvent(invocation.getArgument(0, String.class)));
        mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
        publisher = new WebSocketEventPublisher(registry, backlog, mapper);
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

        boolean delivered = publisher.publishToSession(target, WebSocketEnvelope.of(
                "system.connection.established",
                mapper.createObjectNode().put("type", "connection_established")));

        assertThat(delivered).isTrue();
        verify(target, times(1)).sendMessage(any(TextMessage.class));
        verify(bystander, never()).sendMessage(any(TextMessage.class));
    }

    @Test
    void sessionEmissionReportsUndeliveredFramesWithoutThrowing() throws Exception {
        WebSocketSession broken = connectedSession("s1", "user-1");
        doThrow(new IOException("gone")).when(broken).sendMessage(any(TextMessage.class));

        boolean delivered = publisher.publishToSession(broken, WebSocketEnvelope.of(
                "message.received", mapper.createObjectNode()));

        assertThat(delivered).isFalse(); // observable to durability-critical callers
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

    // --- MIG-051 (WS-BHV-009): backlog store side of the emit paths ---

    @Test
    void roomEmissionStoresBacklogEligibleEventsPerRecipient() {
        connectedSession("s1", "user-1");
        connectedSession("s2", "user-2");
        registry.joinRoom("s1", RealtimeRooms.conversation("00000000-0000-0000-0000-00000000c099"));

        publisher.publishToRoom(RealtimeRooms.conversation(
                        "00000000-0000-0000-0000-00000000c099"),
                WebSocketEnvelope.of("message.received",
                        mapper.createObjectNode().put("id", "m-1")));

        verify(backlog).store(org.mockito.ArgumentMatchers.eq("user-1"),
                org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation(
                        "00000000-0000-0000-0000-00000000c099")),
                any(WebSocketEnvelope.class));
        verify(backlog, never()).store(org.mockito.ArgumentMatchers.eq("user-2"),
                any(), any());
    }

    @Test
    void roomEmissionSkipsIneligibleEventsAndGlobalStoresEveryConnectedUser() {
        WebSocketSession only = connectedSession("s1", "user-1");

        publisher.publishToRoom(RealtimeRooms.conversation("conv-1"),
                WebSocketEnvelope.of("typing.started", mapper.createObjectNode()));
        verify(backlog, never()).store(any(), any(), any());

        publisher.publishToAll(WebSocketEnvelope.of("queue.message.dlq",
                mapper.createObjectNode()));
        verify(backlog, times(1)).store(org.mockito.ArgumentMatchers.eq("user-1"),
                org.mockito.ArgumentMatchers.isNull(), any(WebSocketEnvelope.class));
    }

    @Test
    void sessionEmissionsAreNeverBacklogged() {
        WebSocketSession target = connectedSession("s1", "user-1");

        publisher.publishToSession(target, WebSocketEnvelope.of("message.received",
                mapper.createObjectNode()));

        verify(backlog, never()).store(any(), any(), any());
    }

    // --- MIG-051 review loop (P2): one durable row per user, not per socket ---

    @Test
    void globalEmissionStoresOneBacklogRowPerUserAcrossTheirSessions() {
        connectedSession("s1", "user-1");
        connectedSession("s2", "user-1"); // second live socket of the same user
        connectedSession("s3", "user-2");

        publisher.publishToAll(WebSocketEnvelope.of("message.received",
                mapper.createObjectNode().put("id", "m-1")));

        verify(backlog, times(1)).store(org.mockito.ArgumentMatchers.eq("user-1"),
                org.mockito.ArgumentMatchers.isNull(), any(WebSocketEnvelope.class));
        verify(backlog, times(1)).store(org.mockito.ArgumentMatchers.eq("user-2"),
                org.mockito.ArgumentMatchers.isNull(), any(WebSocketEnvelope.class));
    }

    @Test
    void roomEmissionStoresOneBacklogRowPerUserAcrossTheirSessions()
            throws Exception {
        WebSocketSession first = connectedSession("s1", "user-1");
        connectedSession("s2", "user-1"); // same user, second socket in the room
        registry.joinRoom("s1", RealtimeRooms.conversation("conv-1"));
        registry.joinRoom("s2", RealtimeRooms.conversation("conv-1"));

        publisher.publishToRoom(RealtimeRooms.conversation("conv-1"),
                WebSocketEnvelope.of("notification.received",
                        mapper.createObjectNode().put("id", "n-1")));

        verify(backlog, times(1)).store(org.mockito.ArgumentMatchers.eq("user-1"),
                org.mockito.ArgumentMatchers.eq(RealtimeRooms.conversation("conv-1")),
                any(WebSocketEnvelope.class));
        verify(backlog, times(1)).store(any(), any(), any(WebSocketEnvelope.class));
        // Live fan-out still reaches every session of the user.
        verify(first, times(1)).sendMessage(any(TextMessage.class));
    }

    // --- MIG-051: baseline sender-exclusion fan-outs (WS-OP-PRES/TYPE) ---

    @Test
    void roomEmissionExceptSenderReachesEveryOtherMember() throws Exception {
        WebSocketSession sender = connectedSession("s1", "user-1");
        WebSocketSession other = connectedSession("s2", "user-2");
        registry.joinRoom("s1", RealtimeRooms.conversation("conv-1"));
        registry.joinRoom("s2", RealtimeRooms.conversation("conv-1"));

        publisher.publishToRoom(RealtimeRooms.conversation("conv-1"), "s1",
                WebSocketEnvelope.of("message.received", mapper.createObjectNode()));

        assertThat(firstEnvelopeOf(other).get("event").asText()).isEqualTo("message.received");
        verify(sender, never()).sendMessage(any(TextMessage.class));
        // The baseline store loop stored for every connected member, sender included.
        verify(backlog, times(2)).store(any(), any(), any(WebSocketEnvelope.class));
    }

    @Test
    void globalEmissionExceptSenderReachesEveryOtherSession() throws Exception {
        WebSocketSession sender = connectedSession("s1", "user-1");
        WebSocketSession other = connectedSession("s2", "user-2");

        publisher.publishToAll("s1", WebSocketEnvelope.of("presence.updated",
                mapper.createObjectNode()));

        assertThat(firstEnvelopeOf(other).get("event").asText()).isEqualTo("presence.updated");
        verify(sender, never()).sendMessage(any(TextMessage.class));
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
