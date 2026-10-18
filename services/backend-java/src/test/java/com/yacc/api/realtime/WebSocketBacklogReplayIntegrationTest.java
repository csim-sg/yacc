package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.api.auth.AuthUser;
import com.yacc.entity.User;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.entity.WebSocketBacklogEntry;
import com.yacc.repository.UserRepository;
import com.yacc.repository.WebSocketBacklogRepository;
import com.yacc.service.JwtTokenService;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
/**
 * MIG-051 backlog replay behavior over a real Tomcat upgrade (AC-MIG-051-1;
 * WS-BHV-009, WS-EVT-015/019/020): stored events survive in PostgreSQL,
 * every re-established session restores them in emission order —
 * {@code system.reconnection.started} for a detected reconnect, then
 * {@code system.backlog.replay.started}, the stored envelopes,
 * {@code system.backlog.replay.completed} — the 1h window is the
 * {@code expires_at} filter (expired rows never replay), the post-replay
 * clear prevents duplicate delivery (store/replay/clear lifecycle), an
 * incomplete replay retains the undelivered remainder in PostgreSQL, and
 * the durable window holds one row per user even with several live sockets.
 *
 * <p>Deliberately NOT {@code @Transactional} (WS server threads authenticate
 * outside the test transaction); this class commits and therefore removes
 * exactly its own fixed-UUID rows in {@code @AfterAll} (shared-container
 * conventions).</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class WebSocketBacklogReplayIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String USER_ID = "00000000-0000-0000-0000-00000000c060";
    private static final String CONVERSATION_ID =
            "00000000-0000-0000-0000-00000000c099";

    @org.springframework.boot.test.web.server.LocalServerPort
    private int port;

    @Autowired
    private UserRepository users;

    @Autowired
    private JwtTokenService jwtTokens;

    @Autowired
    private WebSocketBacklogService backlog;

    @Autowired
    private WebSocketReconnectService reconnects;

    @Autowired
    private WebSocketBacklogRepository backlogRows;

    @Autowired
    private WebSocketEventPublisher publisher;

    @Autowired
    private ObjectMapper objectMapper;

    private final ObjectMapper reader = new ObjectMapper();

    /** Sessions this test opened; closed after every test (isolation). */
    private final java.util.List<WebSocketSession> opened = new java.util.ArrayList<>();

    @org.junit.jupiter.api.AfterEach
    void closeOpenedSessions() {
        for (WebSocketSession session : opened) {
            try {
                session.close();
            } catch (Exception ignored) {
                // best-effort teardown
            }
        }
        opened.clear();
        backlogRows.deleteByUserId(USER_ID);
    }

    @AfterAll
    static void removeCommittedFixtureRows(
            @org.springframework.beans.factory.annotation.Autowired UserRepository users,
            @org.springframework.beans.factory.annotation.Autowired WebSocketBacklogRepository backlogRows) {
        backlogRows.deleteByUserId(USER_ID);
        users.deleteAllById(java.util.List.of(USER_ID));
    }

    @Test
    void reconnectionRestoresTheDurableBacklogInOrderThenClearsIt() throws Exception {
        seedUser();
        String token = accessToken();

        // Warmup: the first session's connect-time restore consumes this row,
        // and awaiting the completed marker here proves the server-side
        // establishment callback (including the restore) has fully drained
        // before any rows meant for the reconnected session are stored —
        // a late restore replaying them to the closing socket is the race
        // this test otherwise intermits under (CI-proven).
        backlog.store(USER_ID, null, envelope("message.received", text("warmup")));
        CollectingHandler first = new CollectingHandler();
        WebSocketSession firstSession = connect(first, token);
        first.nextFrame("system.connection.established");
        first.nextFrame("system.backlog.replay.started");
        first.nextFrame("message.received");
        first.nextFrame("system.backlog.replay.completed");

        backlog.store(USER_ID, null,
                envelope("message.received", text("while-you-were-away")));
        backlog.store(USER_ID, RealtimeRooms.conversation(CONVERSATION_ID),
                envelope("message.received", text("conversation-scope")));

        firstSession.close();
        awaitDisconnectRecorded();

        CollectingHandler reconnect = new CollectingHandler();
        WebSocketSession secondSession = connect(reconnect, token);
        reconnect.nextFrame("system.connection.established");
        assertThat(reconnect.nextFrame("system.reconnection.started")).isNotNull();
        reconnect.nextFrame("system.backlog.replay.started");
        JsonNode firstReplayed = reconnect.nextFrame("message.received");
        JsonNode secondReplayed = reconnect.nextFrame("message.received");
        reconnect.nextFrame("system.backlog.replay.completed");

        // The replayed envelopes carry the stored payloads verbatim, in
        // emission order (conversation scope recorded, global row second).
        assertThat(firstReplayed.get("data").get("text").asText())
                .isEqualTo("while-you-were-away");
        assertThat(secondReplayed.get("data").get("text").asText())
                .isEqualTo("conversation-scope");

        // Post-replay clear (WS-BHV-009 store/replay/clear lifecycle).
        assertThat(backlog.replayRows(USER_ID)).isEmpty();
        secondSession.close();
    }

    @Test
    void replayFiltersExpiredRowsOnExpiresAt() throws Exception {
        seedUser();
        String token = accessToken();

        // Own connect/close cycle so the reconnect marker is deterministic
        // regardless of test-method order (the close callback records the
        // disconnect this method's reconnect is recognized by). The warmup
        // row drains this session's connect-time restore before the rows
        // meant for the reconnected session are stored (see the race note in
        // reconnectionRestoresTheDurableBacklogInOrderThenClearsIt).
        backlog.store(USER_ID, null, envelope("message.received", text("warmup")));
        CollectingHandler first = new CollectingHandler();
        WebSocketSession firstSession = connect(first, token);
        first.nextFrame("system.connection.established");
        first.nextFrame("system.backlog.replay.started");
        first.nextFrame("message.received");
        first.nextFrame("system.backlog.replay.completed");
        firstSession.close();
        awaitDisconnectRecorded();

        backlogRows.save(new WebSocketBacklogEntry(USER_ID,
                "message.received", null, "{\"text\":\"expired\"}",
                LocalDateTime.now().minusHours(2), LocalDateTime.now().minusMinutes(5)));
        backlog.store(USER_ID, null,
                envelope("message.received", text("fresh")));

        CollectingHandler reconnect = new CollectingHandler();
        WebSocketSession session = connect(reconnect, token);
        reconnect.nextFrame("system.connection.established");
        reconnect.nextFrame("system.reconnection.started");
        reconnect.nextFrame("system.backlog.replay.started");
        JsonNode replayed = reconnect.nextFrame("message.received");
        reconnect.nextFrame("system.backlog.replay.completed");

        assertThat(replayed.get("data").get("text").asText()).isEqualTo("fresh");
        assertThat(reconnect.nextFrame("message.received", 2)).isNull(); // expired row skipped
        session.close();
    }

    // --- MIG-051 review loop (P1): delivery-tracked retention on send failure ---

    @Test
    void replaySendFailureRetainsTheUndeliveredRowsInPostgreSQL() throws Exception {
        // Explicit emission times pin the replay order regardless of write timing.
        backlogRows.save(new WebSocketBacklogEntry(USER_ID,
                "message.received", null, "{\"seq\":1}",
                LocalDateTime.now().minusMinutes(2), LocalDateTime.now().plusHours(1)));
        backlogRows.save(new WebSocketBacklogEntry(USER_ID,
                "message.received", null, "{\"seq\":2}",
                LocalDateTime.now().minusMinutes(1), LocalDateTime.now().plusHours(1)));

        // Deterministic mid-replay socket death: the start marker and the
        // first row are written, the second row is not. Stubbing the
        // publisher (instead of racing a real close) keeps the failure point
        // exact; the backlog side below is the real PostgreSQL path.
        WebSocketEventPublisher dyingSocket = org.mockito.Mockito.mock(
                WebSocketEventPublisher.class);
        org.mockito.Mockito.when(dyingSocket.publishToSession(
                org.mockito.ArgumentMatchers.any(WebSocketSession.class),
                org.mockito.ArgumentMatchers.any(WebSocketEnvelope.class)))
                .thenReturn(true, true, false);
        WebSocketReconnectService restoreUnderTest = new WebSocketReconnectService(
                backlog, dyingSocket, objectMapper,
                new RealtimeProperties(null,
                        new RealtimeProperties.Reconnect(1000, 5000, 5, 2)));

        restoreUnderTest.onSessionEstablished(
                org.mockito.Mockito.mock(WebSocketSession.class),
                new RealtimeSession("restore-under-test", USER_ID,
                        "restore@fixture.yacc.local", "user", "Restore fixture"));

        // failed + error were reported to the session.
        org.mockito.ArgumentCaptor<WebSocketEnvelope> captor =
                org.mockito.ArgumentCaptor.forClass(WebSocketEnvelope.class);
        org.mockito.Mockito.verify(dyingSocket, org.mockito.Mockito.atLeastOnce())
                .publishToSession(org.mockito.ArgumentMatchers.any(), captor.capture());
        assertThat(captor.getAllValues().stream().map(WebSocketEnvelope::event))
                .contains("system.reconnection.failed", "system.error");

        // The delivered first row is gone; the undelivered second row stays
        // durable — the next replay restores exactly the remainder.
        List<WebSocketBacklogEntry> remaining = backlog.replayRows(USER_ID);
        assertThat(remaining).hasSize(1);
        assertThat(objectMapper.readTree(remaining.get(0).getPayload()).get("seq").asText())
                .isEqualTo("2");
    }

    // --- MIG-051 review loop (P2): one durable row per user across sockets ---

    @Test
    void oneBacklogRowPerUserEvenWithSeveralLiveSessions() throws Exception {
        seedUser();
        String token = accessToken();

        // Drain each session's connect-time restore with its own warmup row
        // (awaiting the completed marker) before the emitted event is stored
        // — otherwise a late restore could consume it (race note in
        // reconnectionRestoresTheDurableBacklogInOrderThenClearsIt).
        CollectingHandler first = new CollectingHandler();
        CollectingHandler second = new CollectingHandler();
        backlog.store(USER_ID, null, envelope("message.received", text("warmup-1")));
        connect(first, token);
        first.nextFrame("system.connection.established");
        first.nextFrame("system.backlog.replay.started");
        first.nextFrame("message.received");
        first.nextFrame("system.backlog.replay.completed");

        backlog.store(USER_ID, null, envelope("message.received", text("warmup-2")));
        connect(second, token);
        second.nextFrame("system.connection.established");
        second.nextFrame("system.backlog.replay.started");
        second.nextFrame("message.received");
        second.nextFrame("system.backlog.replay.completed");

        publisher.publishToAll(envelope("message.received", text("stored-once")));

        // Live fan-out still reaches every session of the user…
        assertThat(first.nextFrame("message.received").get("data").get("text").asText())
                .isEqualTo("stored-once");
        assertThat(second.nextFrame("message.received").get("data").get("text").asText())
                .isEqualTo("stored-once");
        assertThat(first.nextFrame("message.received", 2)).isNull();
        assertThat(second.nextFrame("message.received", 2)).isNull();
        // …while the durable window holds exactly one row for the user.
        assertThat(backlog.replayRows(USER_ID)).hasSize(1);
    }

    private User seedUser() {
        return users.save(new User(USER_ID, "ws-backlog-" + USER_ID + "@fixture.yacc.local",
                "WS Backlog Fixture", "backlog-has-no-login", UserRole.USER,
                UserStatus.ACTIVE, false));
    }

    /**
     * Waits until the server-side close callback has recorded the disconnect
     * (the reconnect marker depends on it) — deterministic under any close
     * handshake vs new-upgrade timing.
     */
    private void awaitDisconnectRecorded() throws Exception {
        long deadline = System.currentTimeMillis() + 10_000;
        while (System.currentTimeMillis() < deadline && !reconnects.isReconnect(USER_ID)) {
            Thread.sleep(50);
        }
        assertThat(reconnects.isReconnect(USER_ID))
                .as("server-observed disconnect recorded within the timeout").isTrue();
    }

    private String accessToken() {
        User user = users.findById(USER_ID).orElseThrow();
        return jwtTokens.issueAccessToken(new AuthUser(user), "ws-backlog-grant");
    }

    private static ObjectNode text(String value) {
        return new ObjectMapper().createObjectNode().put("text", value);
    }

    private WebSocketEnvelope envelope(String event, ObjectNode data) {
        return WebSocketEnvelope.of(event, data);
    }

    private WebSocketSession connect(CollectingHandler handler, String token) throws Exception {
        StandardWebSocketClient client = new StandardWebSocketClient();
        URI uri = URI.create("ws://localhost:" + port + "/ws?token=" + token);
        CompletableFuture<WebSocketSession> future =
                client.execute(handler, new WebSocketHttpHeaders(), uri);
        WebSocketSession session = future.get(10, TimeUnit.SECONDS);
        opened.add(session);
        return session;
    }

    /**
     * Collects inbound frames; {@code nextFrame} skips non-matching events
     * and bounds every wait so a missing frame fails the test instead of
     * hanging the run.
     */
    private static class CollectingHandler extends TextWebSocketHandler {

        private final LinkedBlockingQueue<String> frames = new LinkedBlockingQueue<>();

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            frames.add(message.getPayload());
        }

        JsonNode nextFrame(String event) throws Exception {
            JsonNode frame = nextFrame(event, 10);
            org.assertj.core.api.Assertions.assertThat(frame)
                    .as("expected a %s frame within the timeout", event).isNotNull();
            return frame;
        }

        JsonNode nextFrame(String event, int timeoutSeconds) throws Exception {
            long deadline = System.currentTimeMillis() + timeoutSeconds * 1000L;
            while (System.currentTimeMillis() < deadline) {
                String payload = frames.poll(deadline - System.currentTimeMillis(),
                        TimeUnit.MILLISECONDS);
                if (payload == null) {
                    return null;
                }
                JsonNode frame = reader().readTree(payload);
                if (event.equals(frame.get("event").asText())) {
                    return frame;
                }
            }
            return null;
        }

        private static ObjectMapper reader() {
            return new ObjectMapper();
        }
    }
}
