package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
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
 * MIG-091d offline QA-parity gap closure (#456) — QA-003 TC-RT-004 (also
 * serves TC-RT-003/TC-RT-026, QA-004 SMOKE-004): three rapid
 * {@code message.received} emissions published to a subscribed conversation
 * room reach every subscribed peer session in exact emission order, with no
 * frames lost and none duplicated (ADR-026 raw WebSocket, WS-EVT-005).
 *
 * <p>Reuses the established real-Tomcat raw-WS harness (deliberately NOT
 * {@code @Transactional} — WS server threads authenticate outside the test
 * transaction; fixed UUIDs keep reruns idempotent and this class removes
 * exactly its own committed rows, mirroring
 * {@code WebSocketBacklogReplayIntegrationTest} conventions).</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class WebSocketMessageFanOutOrderingIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String USER_ID = "00000000-0000-0000-0000-00000000c0a0";
    private static final String CONVERSATION_ID = "conv-order-smoke-1";

    @org.springframework.boot.test.web.server.LocalServerPort
    private int port;

    @Autowired
    private UserRepository users;

    @Autowired
    private JwtTokenService jwtTokens;

    @Autowired
    private WebSocketEventPublisher publisher;

    @Autowired
    private WebSocketBacklogRepository backlogRows;

    /** Sessions this test opened; closed after every test (isolation). */
    private final java.util.List<WebSocketSession> opened = new java.util.ArrayList<>();

    @AfterEach
    void closeOpenedSessionsAndDropBacklogRows() {
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
    void threeRapidMessageReceivedEventsFanOutInOrderToSubscribedPeers() throws Exception {
        seedUser();
        String token = accessToken();

        // Two live sessions of the same user, both subscribed to the room.
        CollectingHandler first = new CollectingHandler();
        CollectingHandler second = new CollectingHandler();
        WebSocketSession firstSession = connect(first, token);
        first.nextFrame("system.connection.established");
        WebSocketSession secondSession = connect(second, token);
        second.nextFrame("system.connection.established");

        for (CollectingHandler handler : java.util.List.of(first, second)) {
            handler.session().sendMessage(new TextMessage(
                    "{\"event\":\"subscribe.conversation\",\"data\":\""
                            + CONVERSATION_ID + "\"}"));
            JsonNode ack = handler.nextFrame("conversation.subscribed");
            assertThat(ack.get("data").get("conversationId").asText())
                    .isEqualTo(CONVERSATION_ID);
        }

        // Three rapid emissions — publishToRoom is synchronous per emission,
        // so socket arrival order equals emission order.
        for (int i = 1; i <= 3; i++) {
            publisher.publishToRoom(RealtimeRooms.conversation(CONVERSATION_ID),
                    envelope("message.received", text("rapid-" + i)));
        }

        for (CollectingHandler handler : java.util.List.of(first, second)) {
            JsonNode one = handler.nextFrame("message.received");
            JsonNode two = handler.nextFrame("message.received");
            JsonNode three = handler.nextFrame("message.received");
            assertThat(one.get("data").get("text").asText()).isEqualTo("rapid-1");
            assertThat(two.get("data").get("text").asText()).isEqualTo("rapid-2");
            assertThat(three.get("data").get("text").asText()).isEqualTo("rapid-3");
            // Exactly three — no duplicates and none lost.
            assertThat(handler.nextFrame("message.received", 2)).isNull();
        }

        firstSession.close();
        secondSession.close();
    }

    private User seedUser() {
        return users.save(new User(USER_ID, "ws-order-" + USER_ID + "@fixture.yacc.local",
                "WS Order Fixture", "order-has-no-login", UserRole.USER,
                UserStatus.ACTIVE, false));
    }

    private String accessToken() {
        User user = users.findById(USER_ID).orElseThrow();
        return jwtTokens.issueAccessToken(new AuthUser(user), "ws-order-grant");
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

    /** One subscribed handler, remembering its session for room joins. */
    private static final class CollectingHandler extends TextWebSocketHandler {

        private final LinkedBlockingQueue<String> frames = new LinkedBlockingQueue<>();
        private volatile WebSocketSession session;
        private final ObjectMapper reader = new ObjectMapper();

        @Override
        public void afterConnectionEstablished(WebSocketSession established) {
            this.session = established;
        }

        @Override
        protected void handleTextMessage(WebSocketSession socket, TextMessage message) {
            frames.add(message.getPayload());
        }

        WebSocketSession session() {
            return session;
        }

        JsonNode nextFrame(String event) throws Exception {
            JsonNode frame = nextFrame(event, 10);
            assertThat(frame).as("expected a %s frame within the timeout", event).isNotNull();
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
                JsonNode frame = reader.readTree(payload);
                if (event.equals(frame.get("event").asText())) {
                    return frame;
                }
            }
            return null;
        }
    }
}
