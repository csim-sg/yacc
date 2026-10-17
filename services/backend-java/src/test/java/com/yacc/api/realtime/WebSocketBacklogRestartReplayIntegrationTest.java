package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.databind.JsonNode;
import com.yacc.YaccApplication;
import com.yacc.api.auth.AuthUser;
import com.yacc.entity.User;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.repository.UserRepository;
import com.yacc.repository.WebSocketBacklogRepository;
import com.yacc.service.JwtTokenService;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;

/**
 * AC-MIG-051-1 restart replay demo: the backlog is written by one running
 * application instance, then a <strong>fresh</strong> application instance —
 * full Spring Boot restart with empty in-memory state (no registry, no
 * reconnect memory, cold caches) — boots against the same PostgreSQL and
 * replays the durable {@code websocket_backlog} rows to a newly connected
 * session. ADR-028: PostgreSQL (not in-memory, not Redis) is what makes the
 * 1h replay survive restart.
 *
 * <p>The restarted instance is a real {@code YaccApplication} boot on the
 * {@code test} profile (same signing key ⇒ tokens minted by the writer
 * instance verify) with its datasource pointed at the shared pinned
 * container. Deliberately NOT {@code @Transactional}; this class removes
 * exactly its own fixed-UUID rows in {@code @AfterAll}.</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class WebSocketBacklogRestartReplayIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String USER_ID = "00000000-0000-0000-0000-00000000c070";

    @org.springframework.boot.test.web.server.LocalServerPort
    private int port;

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

    @Autowired
    private UserRepository users;

    @Autowired
    private JwtTokenService jwtTokens;

    @Autowired
    private WebSocketBacklogService backlog;

    @AfterAll
    static void removeCommittedFixtureRows(
            @org.springframework.beans.factory.annotation.Autowired UserRepository users,
            @org.springframework.beans.factory.annotation.Autowired WebSocketBacklogRepository backlogRows) {
        backlogRows.deleteByUserId(USER_ID);
        users.deleteAllById(java.util.List.of(USER_ID));
    }

    @Test
    void backlogWrittenByOneInstanceIsReplayedByAFreshInstance() throws Exception {
        users.save(new User(USER_ID, "ws-restart-" + USER_ID + "@fixture.yacc.local",
                "WS Restart Fixture", "restart-has-no-login", UserRole.USER,
                UserStatus.ACTIVE, false));
        User user = users.findById(USER_ID).orElseThrow();
        String token = jwtTokens.issueAccessToken(new AuthUser(user), "ws-restart-grant");

        backlog.store(USER_ID, null, WebSocketEnvelope.of("message.received",
                new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode()
                        .put("text", "written-before-restart")));
        backlog.store(USER_ID, null, WebSocketEnvelope.of("queue.message.dlq",
                new com.fasterxml.jackson.databind.ObjectMapper().createObjectNode()
                        .put("jobId", UUID.randomUUID().toString())));

        ConfigurableApplicationContext restarted;
        try {
            // Program arguments (not builder default properties): they must
            // OUTRANK application.yml, which pins the datasource and port.
            restarted = new SpringApplicationBuilder(YaccApplication.class)
                    .profiles("test")
                    .run(
                            "--server.port=0",
                            "--spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                            "--spring.datasource.username=" + POSTGRES.getUsername(),
                            "--spring.datasource.password=" + POSTGRES.getPassword());
        } catch (Exception e) {
            throw new IllegalStateException("Restarted instance failed to boot", e);
        }
        try {
            int restartedPort = restarted.getEnvironment()
                    .getProperty("local.server.port", Integer.class);
            CollectingHandler handler = new CollectingHandler();
            WebSocketSession session = connectWithRetry(restartedPort, token, handler);

            handler.nextFrame("system.connection.established");
            // Fresh in-memory state: no reconnect marker fires; the durable
            // backlog alone proves the survival.
            handler.nextFrame("system.backlog.replay.started");
            JsonNode replayed = handler.nextFrame("message.received");
            assertThat(replayed.get("data").get("text").asText())
                    .isEqualTo("written-before-restart");
            handler.nextFrame("queue.message.dlq");
            handler.nextFrame("system.backlog.replay.completed");

            session.close();
        } finally {
            restarted.close();
        }
    }

    private WebSocketSession connectWithRetry(int targetPort, String token,
            TextWebSocketHandler handler) throws Exception {
        StandardWebSocketClient client = new StandardWebSocketClient();
        URI uri = URI.create("ws://localhost:" + targetPort + "/ws?token=" + token);
        long deadline = System.currentTimeMillis() + 30_000;
        Exception last = null;
        while (System.currentTimeMillis() < deadline) {
            try {
                CompletableFuture<WebSocketSession> future =
                        client.execute(handler, new WebSocketHttpHeaders(), uri);
                return future.get(10, TimeUnit.SECONDS);
            } catch (Exception e) {
                last = e;
                Thread.sleep(250);
            }
        }
        throw new IllegalStateException("Restarted instance never accepted the upgrade", last);
    }

    /**
     * Collects inbound frames; {@code nextFrame} skips non-matching events
     * and bounds every wait so a missing frame fails the test instead of
     * hanging the run.
     */
    private static class CollectingHandler extends TextWebSocketHandler {

        private final java.util.concurrent.LinkedBlockingQueue<String> frames =
                new java.util.concurrent.LinkedBlockingQueue<>();

        @Override
        protected void handleTextMessage(WebSocketSession session,
                org.springframework.web.socket.TextMessage message) {
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
