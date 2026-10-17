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
 * {@code expires_at} filter (expired rows never replay), and the
 * post-replay clear prevents duplicate delivery (store/replay/clear
 * lifecycle).
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
    private WebSocketBacklogRepository backlogRows;

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

        CollectingHandler first = new CollectingHandler();
        WebSocketSession firstSession = connect(first, token);
        first.nextFrame("system.connection.established");

        backlog.store(USER_ID, null,
                envelope("message.received", text("while-you-were-away")));
        backlog.store(USER_ID, RealtimeRooms.conversation(CONVERSATION_ID),
                envelope("message.received", text("conversation-scope")));

        firstSession.close();

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

        backlogRows.save(new com.yacc.entity.WebSocketBacklogEntry(USER_ID,
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

    private User seedUser() {
        return users.save(new User(USER_ID, "ws-backlog-" + USER_ID + "@fixture.yacc.local",
                "WS Backlog Fixture", "backlog-has-no-login", UserRole.USER,
                UserStatus.ACTIVE, false));
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
