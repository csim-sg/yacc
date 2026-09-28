package com.yacc.realtime.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import com.yacc.realtime.model.RealtimeRooms;
import com.yacc.realtime.model.RealtimeSession;

/**
 * Unit tests for the raw-WebSocket session registry (MIG-050; ADR-026;
 * WS-OP-CONV-001/004/005, WS-BHV-006/007/008): registration, room
 * membership across the three frozen namespaces, and idempotent cleanup.
 */
class WebSocketSessionRegistryTest {

    private WebSocketSessionRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new WebSocketSessionRegistry();
    }

    private static WebSocketSession channel(String sessionId) {
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn(sessionId);
        return session;
    }

    private static RealtimeSession identity(String sessionId, String userId) {
        return new RealtimeSession(sessionId, userId, userId + "@fixture.yacc.local",
                "user", "Fixture");
    }

    @Test
    void registeredSessionIsQueryableByIdentityAndChannel() {
        registry.register(identity("s1", "user-1"), channel("s1"));

        assertThat(registry.identity("s1")).hasValueSatisfying(session -> {
            assertThat(session.userId()).isEqualTo("user-1");
            assertThat(session.role()).isEqualTo("user");
        });
        assertThat(registry.channel("s1")).isPresent();
    }

    @Test
    void joinRoomIndexesMembershipAcrossAllThreeNamespaces() {
        registry.register(identity("s1", "user-1"), channel("s1"));
        registry.joinRoom("s1", RealtimeRooms.user("user-1"));
        registry.joinRoom("s1", RealtimeRooms.conversation("conv-1"));
        registry.joinRoom("s1", RealtimeRooms.connector("telegram"));

        assertThat(registry.channelsInRoom(RealtimeRooms.user("user-1")))
                .hasSize(1);
        assertThat(registry.channelsInRoom(RealtimeRooms.conversation("conv-1")))
                .hasSize(1);
        assertThat(registry.channelsInRoom(RealtimeRooms.connector("telegram")))
                .hasSize(1);
    }

    @Test
    void multipleSessionsOfSameUserShareThePersonalRoom() {
        registry.register(identity("s1", "user-1"), channel("s1"));
        registry.register(identity("s2", "user-1"), channel("s2"));
        registry.joinRoom("s1", RealtimeRooms.user("user-1"));
        registry.joinRoom("s2", RealtimeRooms.user("user-1"));

        assertThat(registry.channelsInRoom(RealtimeRooms.user("user-1"))).hasSize(2);
    }

    @Test
    void leaveRoomRemovesOnlyThatMembership() {
        registry.register(identity("s1", "user-1"), channel("s1"));
        registry.joinRoom("s1", RealtimeRooms.conversation("conv-1"));
        registry.joinRoom("s1", RealtimeRooms.conversation("conv-2"));

        registry.leaveRoom("s1", RealtimeRooms.conversation("conv-1"));

        assertThat(registry.channelsInRoom(RealtimeRooms.conversation("conv-1"))).isEmpty();
        assertThat(registry.channelsInRoom(RealtimeRooms.conversation("conv-2"))).hasSize(1);
    }

    @Test
    void unregisterRemovesSessionFromEveryRoomAndIsIdempotent() {
        registry.register(identity("s1", "user-1"), channel("s1"));
        registry.joinRoom("s1", RealtimeRooms.user("user-1"));
        registry.joinRoom("s1", RealtimeRooms.conversation("conv-1"));
        registry.joinRoom("s1", RealtimeRooms.connector("irc"));

        registry.unregister("s1");
        registry.unregister("s1"); // second call must be a no-op

        assertThat(registry.channel("s1")).isEmpty();
        assertThat(registry.identity("s1")).isEmpty();
        assertThat(registry.channelsInRoom(RealtimeRooms.user("user-1"))).isEmpty();
        assertThat(registry.channelsInRoom(RealtimeRooms.conversation("conv-1"))).isEmpty();
        assertThat(registry.channelsInRoom(RealtimeRooms.connector("irc"))).isEmpty();
    }

    @Test
    void roomMembershipIsSessionScopedSoOtherSessionsSurvive() {
        registry.register(identity("s1", "user-1"), channel("s1"));
        registry.register(identity("s2", "user-2"), channel("s2"));
        registry.joinRoom("s1", RealtimeRooms.conversation("conv-1"));
        registry.joinRoom("s2", RealtimeRooms.conversation("conv-1"));

        registry.unregister("s1");

        List<?> remaining = List.copyOf(
                registry.channelsInRoom(RealtimeRooms.conversation("conv-1")));
        assertThat(remaining).hasSize(1);
        assertThat(registry.channel("s2")).isPresent();
    }

    @Test
    void operationsForUnknownSessionsAreNoOps() {
        registry.joinRoom("ghost", RealtimeRooms.conversation("conv-1"));
        registry.leaveRoom("ghost", RealtimeRooms.conversation("conv-1"));
        registry.unregister("ghost");

        assertThat(registry.channel("ghost")).isEmpty();
        assertThat(registry.channelsInRoom(RealtimeRooms.conversation("conv-1"))).isEmpty();
        assertThat(registry.allChannels()).isEmpty();
    }
}
