package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

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
import com.yacc.entity.WebSocketBacklogEntry;

/**
 * Unit tests for the server reconnection half (MIG-051; WS-EVT-015/016,
 * WS-EVT-019/020, WS-BHV-009/011): the reconnect marker on a detected
 * reconnect (user disconnected within the policy window), the durable
 * backlog restoration sequence (replay started → stored envelopes → clear →
 * completed), the fresh-session semantics (no marker, no replay without
 * rows), and the {@code system.reconnection.failed} + {@code system.error}
 * pair when restoration cannot be completed.
 */
class WebSocketReconnectServiceTest {

    private static final RealtimeSession IDENTITY = new RealtimeSession("s1", "user-1",
            "user-1@fixture.yacc.local", "user", "Fixture user-1");

    private WebSocketBacklogService backlog;
    private WebSocketEventPublisher publisher;
    private WebSocketSession session;
    private ObjectMapper mapper;
    private WebSocketReconnectService service;
    private final List<WebSocketEnvelope> emitted = new CopyOnWriteArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        backlog = mock(WebSocketBacklogService.class);
        publisher = mock(WebSocketEventPublisher.class);
        mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
        doAnswer(invocation -> {
            emitted.add(invocation.getArgument(1));
            return null;
        }).when(publisher).publishToSession(any(WebSocketSession.class),
                any(WebSocketEnvelope.class));
        service = new WebSocketReconnectService(backlog, publisher, mapper,
                new RealtimeProperties(null,
                        new RealtimeProperties.Reconnect(1000, 5000, 5, 2)));

        session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("s1");
    }

    private List<String> eventNames() {
        List<String> names = new CopyOnWriteArrayList<>();
        for (WebSocketEnvelope envelope : emitted) {
            names.add(envelope.event());
        }
        return names;
    }

    private void givenBacklogRows(int count) {
        List<WebSocketBacklogEntry> rows = new java.util.ArrayList<>();
        for (int i = 0; i < count; i++) {
            rows.add(new WebSocketBacklogEntry("user-1", "message.received", null,
                    "{\"id\":\"m-" + i + "\"}", LocalDateTime.now(),
                    LocalDateTime.now().plusHours(1)));
        }
        when(backlog.replayRows("user-1")).thenReturn(rows);
    }

    @Test
    void firstEstablishmentRestoresWithoutTheReconnectMarker() throws Exception {
        givenBacklogRows(2);

        service.onSessionEstablished(session, IDENTITY);

        assertThat(eventNames()).containsExactly(
                "system.backlog.replay.started",
                "message.received",
                "message.received",
                "system.backlog.replay.completed");
        verify(backlog).clear("user-1");
    }

    @Test
    void detectedReconnectEmitsTheMarkerBeforeRestoration() throws Exception {
        service.onSessionClosed(IDENTITY); // server-observed disconnect
        givenBacklogRows(1);

        service.onSessionEstablished(session, IDENTITY);

        assertThat(eventNames()).containsExactly(
                "system.reconnection.started",
                "system.backlog.replay.started",
                "message.received",
                "system.backlog.replay.completed");
    }

    @Test
    void reconnectionOutsideThePolicyWindowIsNotAMarker() throws Exception {
        service.onSessionClosed(IDENTITY);
        // Age the disconnect beyond the 5000ms policy window.
        try {
            java.lang.reflect.Field field = WebSocketReconnectService.class
                    .getDeclaredField("lastDisconnectedAtByUserId");
            field.setAccessible(true);
            @SuppressWarnings("unchecked")
            java.util.Map<String, Long> tracker =
                    (java.util.Map<String, Long>) field.get(service);
            tracker.put("user-1", System.currentTimeMillis() - 6000);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        givenBacklogRows(1);

        service.onSessionEstablished(session, IDENTITY);

        assertThat(eventNames()).doesNotContain("system.reconnection.started");
    }

    @Test
    void establishmentWithoutBacklogRestoresNothing() throws Exception {
        when(backlog.replayRows("user-1")).thenReturn(List.of());

        service.onSessionEstablished(session, IDENTITY);

        assertThat(eventNames()).isEmpty();
        verify(backlog, never()).clear(any());
    }

    @Test
    void failedRestorationEmitsReconnectionFailedAndSystemError() throws Exception {
        service.onSessionClosed(IDENTITY);
        givenBacklogRows(1);
        doThrow(new IllegalStateException("replay blew up"))
                .when(backlog).clear("user-1");

        service.onSessionEstablished(session, IDENTITY);

        assertThat(eventNames()).containsSubsequence(
                "system.reconnection.started",
                "system.backlog.replay.started",
                "message.received",
                "system.reconnection.failed",
                "system.error");
        ArgumentCaptor<WebSocketEnvelope> captor =
                ArgumentCaptor.forClass(WebSocketEnvelope.class);
        verify(publisher, org.mockito.Mockito.atLeastOnce())
                .publishToSession(org.mockito.ArgumentMatchers.eq(session),
                        captor.capture());
        WebSocketEnvelope error = captor.getAllValues().stream()
                .filter(envelope -> envelope.event().equals("system.error"))
                .findFirst()
                .orElseThrow();
        assertThat(error.data().get("error").get("code").asText())
                .isEqualTo(WebSocketReconnectService.ERROR_CODE_BACKLOG_REPLAY);
    }

    @Test
    void aFreshServiceWithoutDisconnectMemoryNeverMarks() {
        givenBacklogRows(1);
        // No onSessionClosed ever recorded on this service instance.
        WebSocketReconnectService fresh = new WebSocketReconnectService(backlog, publisher,
                mapper, new RealtimeProperties(null,
                        new RealtimeProperties.Reconnect(1000, 5000, 5, 2)));

        fresh.onSessionEstablished(session, IDENTITY);

        assertThat(eventNames()).doesNotContain("system.reconnection.started");
    }
}
