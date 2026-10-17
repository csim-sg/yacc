package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
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
import com.yacc.api.auth.AuthUser;
import com.yacc.entity.User;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.repository.UserRepository;
import com.yacc.service.JwtTokenService;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;

/**
 * MIG-051 heartbeat behavior over a real socket (AC-MIG-051-2; WS-EVT-017,
 * WS-BHV-010): the scheduling loop broadcasts enveloped
 * {@code system.heartbeat} frames carrying the frozen {@code heartbeat}
 * system payload type. The interval is compressed via
 * {@code yacc.realtime.heartbeat-interval-ms} (frozen default 60000) so the
 * periodic emission is observable in test time.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = "yacc.realtime.heartbeat-interval-ms=120")
@ActiveProfiles("test")
class WebSocketHeartbeatIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String USER_ID = "00000000-0000-0000-0000-00000000c063";

    @org.springframework.boot.test.web.server.LocalServerPort
    private int port;

    @Autowired
    private UserRepository users;

    @Autowired
    private JwtTokenService jwtTokens;

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
            @org.springframework.beans.factory.annotation.Autowired UserRepository users) {
        users.deleteAllById(java.util.List.of(USER_ID));
    }

    @Test
    void heartbeatsArrivePeriodicallyWithTheFrozenSystemPayload() throws Exception {
        users.save(new User(USER_ID, "ws-heartbeat@fixture.yacc.local",
                "Heartbeat Fixture", "heartbeat-has-no-login", UserRole.USER,
                UserStatus.ACTIVE, false));
        User user = users.findById(USER_ID).orElseThrow();
        String token = jwtTokens.issueAccessToken(new AuthUser(user), "ws-heartbeat-grant");

        CollectingHandler handler = new CollectingHandler();
        WebSocketSession session = connect(handler, token);
        handler.nextFrame("system.connection.established");

        JsonNode firstBeat = handler.nextFrame("system.heartbeat");
        assertThat(firstBeat.get("data").get("type").asText()).isEqualTo("heartbeat");
        assertThat(firstBeat.get("data").get("timestamp").asText()).isNotEmpty();
        JsonNode secondBeat = handler.nextFrame("system.heartbeat");
        assertThat(secondBeat).isNotNull();

        session.close();
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
            long deadline = System.currentTimeMillis() + 10_000;
            while (System.currentTimeMillis() < deadline) {
                String payload = frames.poll(deadline - System.currentTimeMillis(),
                        TimeUnit.MILLISECONDS);
                org.assertj.core.api.Assertions.assertThat(payload)
                        .as("expected a %s frame within the timeout", event).isNotNull();
                JsonNode frame = new com.fasterxml.jackson.databind.ObjectMapper()
                        .readTree(payload);
                if (event.equals(frame.get("event").asText())) {
                    return frame;
                }
            }
            throw new AssertionError("No " + event + " frame within the timeout");
        }
    }
}
