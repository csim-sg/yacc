package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

/**
 * Unit tests for the raw-WS presence behavior (MIG-051; WS-EVT-009/012/013,
 * WS-OP-PRES-001..005, WS-BHV-014): canonical {@code presence.updated}
 * shape on every emission, sender exclusion on broadcasts, the
 * {@code online.users} reply, the granular {@code user.status.changed}
 * broadcast, and the fail-closed bad-frame path.
 */
class WebSocketPresenceServiceTest {

    private WebSocketSessionRegistry registry;
    private WebSocketEventPublisher publisher;
    private ObjectMapper mapper;
    private WebSocketPresenceService service;

    private WebSocketSession session;
    private final List<WebSocketEnvelope> emitted = new CopyOnWriteArrayList<>();

    @BeforeEach
    void setUp() {
        registry = new WebSocketSessionRegistry();
        publisher = mock(WebSocketEventPublisher.class);
        mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
        service = new WebSocketPresenceService(registry, publisher, mapper);

        session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("s1");
        doAnswer(invocation -> {
            emitted.add(invocation.getArgument(1));
            return null;
        }).when(publisher).publishToSession(any(WebSocketSession.class),
                any(WebSocketEnvelope.class));
        doAnswer(invocation -> {
            emitted.add(invocation.getArgument(1));
            return null;
        }).when(publisher).publishToAll(ArgumentMatchers.anyString(),
                any(WebSocketEnvelope.class));
        doAnswer(invocation -> {
            emitted.add(invocation.getArgument(0));
            return null;
        }).when(publisher).publishToAll(any(WebSocketEnvelope.class));
    }

    private RealtimeSession registered(String sessionId, String userId) {
        RealtimeSession identity = new RealtimeSession(sessionId, userId,
                userId + "@fixture.yacc.local", "user", "Fixture " + userId);
        WebSocketSession channel = mock(WebSocketSession.class);
        org.mockito.Mockito.when(channel.getId()).thenReturn(sessionId);
        registry.register(identity, channel);
        return identity;
    }

    private WebSocketEnvelope emitted(int index) {
        return emitted.get(index);
    }

    @Test
    void inboundPresenceUpdatedBroadcastsTheCanonicalShapeExceptSender() {
        registered("s1", "user-1");

        service.onPresenceUpdated(session, mapper.createObjectNode()
                .put("userId", "user-1")
                .put("status", "online")
                .put("lastSeen", "2026-10-17T10:00:00Z"));

        verify(publisher).publishToAll(eq("s1"), any(WebSocketEnvelope.class));
        WebSocketEnvelope envelope = emitted(0);
        assertThat(envelope.event()).isEqualTo("presence.updated");
        JsonNode data = envelope.data();
        assertThat(data.get("userId").asText()).isEqualTo("user-1");
        assertThat(data.get("status").asText()).isEqualTo("online");
        assertThat(data.get("lastSeen").asText()).endsWith("Z");
        assertThat(data.fieldNames()).toIterable().containsExactly("userId", "status", "lastSeen");
    }

    @Test
    void inboundPresenceUpdatedWithAnOffEnumStatusIsRefused() {
        registered("s1", "user-1");

        service.onPresenceUpdated(session, mapper.createObjectNode()
                .put("userId", "user-1")
                .put("status", "away") // retired baseline value — not the canonical enum
                .put("lastSeen", "2026-10-17T10:00:00Z"));

        assertThat(emitted).hasSize(1);
        assertThat(emitted(0).event()).isEqualTo("system.error");
    }

    @Test
    void userOnlineBroadcastsOnlinePresenceAndRepliesOnlineUsers() {
        registered("s1", "user-1");
        registered("s2", "user-2"); // a second connected identity

        service.onUserOnline(session, mapper.createObjectNode()
                .put("userId", "user-1").put("name", "Fixture user-1"));

        assertThat(emitted(0).event()).isEqualTo("presence.updated");
        assertThat(emitted(0).data().get("status").asText()).isEqualTo("online");
        verify(publisher).publishToAll(eq("s1"), any(WebSocketEnvelope.class));
        assertThat(emitted(1).event()).isEqualTo("online.users");
        assertThat(emitted(1).data().get("users")).hasSize(2);
        assertThat(emitted(1).data().get("timestamp").asText()).isNotEmpty();
    }

    @Test
    void userOfflineBroadcastsOfflinePresenceExceptSender() {
        registered("s1", "user-1");

        service.onUserOffline(session, mapper.createObjectNode().put("userId", "user-1"));

        verify(publisher).publishToAll(eq("s1"), any(WebSocketEnvelope.class));
        assertThat(emitted(0).event()).isEqualTo("presence.updated");
        assertThat(emitted(0).data().get("status").asText()).isEqualTo("offline");
    }

    @Test
    void userStatusBroadcastsTheGranularStatusChangeExceptSender() {
        registered("s1", "user-1");

        service.onUserStatus(session, mapper.createObjectNode()
                .put("userId", "user-1").put("status", "away"));

        verify(publisher).publishToAll(eq("s1"), any(WebSocketEnvelope.class));
        assertThat(emitted(0).event()).isEqualTo("user.status.changed");
        JsonNode data = emitted(0).data();
        assertThat(data.get("userId").asText()).isEqualTo("user-1");
        assertThat(data.get("status").asText()).isEqualTo("away");
        assertThat(data.get("timestamp").asText()).isNotEmpty();
    }

    @Test
    void userStatusWithAnUnknownStatusIsRefused() {
        registered("s1", "user-1");

        service.onUserStatus(session, mapper.createObjectNode()
                .put("userId", "user-1").put("status", "invisible"));

        assertThat(emitted).hasSize(1);
        assertThat(emitted(0).event()).isEqualTo("system.error");
    }

    @Test
    void requestOnlineUsersRepliesWithTheOnlineUserIds() {
        registered("s1", "user-1");
        registered("s2", "user-2");

        service.onRequestOnlineUsers(session);

        verify(publisher).publishToSession(eq(session), any(WebSocketEnvelope.class));
        assertThat(emitted(0).event()).isEqualTo("online.users");
        assertThat(emitted(0).data().get("users")).hasSize(2);
    }

    @Test
    void lastSocketOffDisconnectBroadcastsOfflineForTheUser() {
        registered("s1", "user-1");
        registry.unregister("s1"); // the closing socket is gone already

        service.broadcastOfflineIfLastSocket(new RealtimeSession("s1", "user-1",
                "user-1@fixture.yacc.local", "user", "Fixture user-1"));

        verify(publisher).publishToAll(any(WebSocketEnvelope.class));
        assertThat(emitted(0).event()).isEqualTo("presence.updated");
        assertThat(emitted(0).data().get("status").asText()).isEqualTo("offline");
    }

    @Test
    void disconnectWithARemainingSocketOfTheSameUserStaysSilent() {
        registered("s1", "user-1");
        registered("s2", "user-1"); // second socket of the same user
        registry.unregister("s1");

        service.broadcastOfflineIfLastSocket(new RealtimeSession("s1", "user-1",
                "user-1@fixture.yacc.local", "user", "Fixture user-1"));

        verify(publisher, never()).publishToAll(any(WebSocketEnvelope.class));
        assertThat(new ArrayList<>(emitted)).isEmpty();
    }
}
