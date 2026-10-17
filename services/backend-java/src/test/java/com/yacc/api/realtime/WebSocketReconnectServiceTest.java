package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedDeque;
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
 * rows), the {@code system.reconnection.failed} + {@code system.error} pair
 * when restoration cannot be completed — including a repository read
 * failure —, and delivery-tracked retention: only the delivered rows are
 * cleared, an incomplete replay retains the undelivered remainder.
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

    /**
     * Per-send results consumed in order (a replay write failure is a
     * {@code false} head); sends beyond the queue succeed.
     */
    private final Queue<Boolean> sendResults = new ConcurrentLinkedDeque<>();

    @BeforeEach
    void setUp() throws Exception {
        backlog = mock(WebSocketBacklogService.class);
        publisher = mock(WebSocketEventPublisher.class);
        mapper = JsonMapper.builder()
                .addModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                .build();
        doAnswer(invocation -> {
            boolean delivered = sendResults.isEmpty() ? true : sendResults.poll();
            if (delivered) {
                emitted.add(invocation.getArgument(1));
            }
            return delivered;
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

    private List<WebSocketBacklogEntry> givenBacklogRows(int count) {
        List<WebSocketBacklogEntry> rows = new java.util.ArrayList<>();
        for (int i = 0; i < count; i++) {
            WebSocketBacklogEntry row = mock(WebSocketBacklogEntry.class);
            when(row.getId()).thenReturn((long) (i + 1));
            when(row.getEventName()).thenReturn("message.received");
            when(row.getPayload()).thenReturn("{\"id\":\"m-" + i + "\"}");
            rows.add(row);
        }
        when(backlog.replayRows("user-1")).thenReturn(rows);
        return rows;
    }

    @Test
    void firstEstablishmentRestoresWithoutTheReconnectMarker() throws Exception {
        List<WebSocketBacklogEntry> rows = givenBacklogRows(2);

        service.onSessionEstablished(session, IDENTITY);

        assertThat(eventNames()).containsExactly(
                "system.backlog.replay.started",
                "message.received",
                "message.received",
                "system.backlog.replay.completed");
        verify(backlog).clear("user-1", rows);
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
        verify(backlog, never()).clear(any(), any());
    }

    @Test
    void replayReadFailureEmitsReconnectionFailedAndSystemErrorAndRetainsRows() {
        when(backlog.replayRows("user-1")).thenThrow(new IllegalStateException("db down"));

        service.onSessionEstablished(session, IDENTITY);

        // The read is inside the failure path: failed + error, nothing else,
        // and no clear touched the durable rows.
        assertThat(eventNames()).containsExactly(
                "system.reconnection.failed", "system.error");
        verify(backlog, never()).clear(any(), any());
    }

    @Test
    void undeliverableStartMarkerRetainsEveryRow() throws Exception {
        givenBacklogRows(2);
        sendResults.add(false); // the replay start marker cannot be written

        service.onSessionEstablished(session, IDENTITY);

        assertThat(eventNames()).containsExactly(
                "system.reconnection.failed", "system.error");
        verify(backlog, never()).clear(any(), any());
    }

    @Test
    void undeliverableReplayRowRetainsTheUndeliveredRemainderOnly() throws Exception {
        List<WebSocketBacklogEntry> rows = givenBacklogRows(3);
        sendResults.add(true); // start marker
        sendResults.add(true); // first row
        sendResults.add(false); // second row fails

        service.onSessionEstablished(session, IDENTITY);

        assertThat(eventNames()).containsSubsequence(
                "system.backlog.replay.started",
                "message.received",
                "system.reconnection.failed",
                "system.error");
        assertThat(eventNames()).doesNotContain("system.backlog.replay.completed");
        // Only the delivered prefix is cleared; the failed row and its
        // successors stay durable for the next replay.
        verify(backlog).clear("user-1", List.of(rows.get(0)));
        verify(backlog, org.mockito.Mockito.times(1)).clear(any(), any());
    }

    @Test
    void undeliverableCompletedMarkerStillReportsTheIncompleteSequence() throws Exception {
        List<WebSocketBacklogEntry> rows = givenBacklogRows(1);
        sendResults.add(true); // start marker
        sendResults.add(true); // the row
        sendResults.add(false); // completed marker fails

        service.onSessionEstablished(session, IDENTITY);

        assertThat(eventNames()).containsSubsequence(
                "system.backlog.replay.started",
                "message.received",
                "system.reconnection.failed",
                "system.error");
        assertThat(eventNames()).doesNotContain("system.backlog.replay.completed");
        // Every row was delivered, so none is retained for re-delivery.
        verify(backlog, org.mockito.Mockito.atLeastOnce())
                .clear("user-1", rows);
    }

    @Test
    void failedRestorationEmitsReconnectionFailedAndSystemError() throws Exception {
        service.onSessionClosed(IDENTITY);
        List<WebSocketBacklogEntry> rows = givenBacklogRows(1);
        doThrow(new IllegalStateException("clear blew up"))
                .when(backlog).clear("user-1", rows);

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
