package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.util.UUID;
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
import com.yacc.api.auth.AuthUser;
import com.yacc.api.connector.ConnectorCircuitBreaker;
import com.yacc.api.connector.ConnectorStatus;
import com.yacc.api.connector.ConnectorStatusListener;
import com.yacc.entity.User;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.repository.UserRepository;
import com.yacc.service.JwtTokenService;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;

/**
 * MIG-062 connector&rarr;realtime bridge over real sockets (AC-MIG-062-6;
 * ledger WS-OP-CONN-001/002/005/006, WS-RAW-008/009/012/013, WS-BHV-008):
 * the four frozen inbound connector ops are demuxed with the frozen bare
 * payloads and produce the frozen enveloped emissions to the pinned targets
 * (conversation room / global broadcast / {@code connector:{platform}} room);
 * a malformed payload takes the existing {@code system.error} path; the
 * server-side connector-status emission through the additive seam emits
 * {@code connector.status} broadcast + {@code status.updated} room frame and
 * resets the platform breaker (the G6 un-wedge path).
 *
 * <p>Deliberately NOT {@code @Transactional}; this class removes exactly its
 * own fixed-UUID rows in {@code @AfterAll} (shared-container conventions).
 * The relay emissions never touch the DB — no rows are written here.</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class ConnectorRealtimeBridgeIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ALICE_ID = "00000000-0000-0000-0000-00000000c071";
    private static final String CONVERSATION_ID = "00000000-0000-0000-0000-00000000c072";

    @org.springframework.boot.test.web.server.LocalServerPort
    private int port;

    @Autowired
    private UserRepository users;

    @Autowired
    private JwtTokenService jwtTokens;

    @Autowired
    private ConnectorStatusListener statusListener;

    @Autowired
    private ConnectorCircuitBreaker breaker;

    private final java.util.List<WebSocketSession> opened = new java.util.ArrayList<>();

    @AfterEach
    void closeOpenedSessions() {
        for (WebSocketSession session : opened) {
            try {
                session.close();
            } catch (Exception ignored) {
                // best-effort teardown
            }
        }
        opened.clear();
        breaker.recordSuccess("telegram");
        breaker.recordSuccess("irc");
    }

    @AfterAll
    static void removeCommittedFixtureRows(
            @org.springframework.beans.factory.annotation.Autowired UserRepository users) {
        users.deleteAllById(java.util.List.of(ALICE_ID));
    }

    @Test
    void theFourConnectorRelayOpsProduceTheFrozenEnvelopedEmissions() throws Exception {
        seedUsers();
        String token = accessToken(ALICE_ID);

        CollectingHandler conversationClient = new CollectingHandler();
        CollectingHandler opsClient = new CollectingHandler();
        WebSocketSession conversationSession = connect(conversationClient, token);
        WebSocketSession opsSession = connect(opsClient, token);
        conversationClient.nextFrame("system.connection.established");
        opsClient.nextFrame("system.connection.established");

        conversationSession.sendMessage(inbound("subscribe.conversation", text(CONVERSATION_ID)));
        conversationClient.nextFrame("conversation.subscribed");
        opsSession.sendMessage(inbound("connector.subscribe",
                object().put("platform", "telegram")));
        opsClient.nextFrame("connector.subscribed");

        // connector.message.received → message.received to the conversation room.
        conversationSession.sendMessage(inbound("connector.message.received", object()
                .put("conversationId", CONVERSATION_ID)
                .put("messageId", UUID.randomUUID().toString())
                .put("platform", "telegram")
                .put("senderId", "555")
                .put("senderName", "Tg User")
                .put("body", "bridged hello")
                .put("timestamp", "2026-10-18T10:00:00Z")));
        JsonNode received = conversationClient.nextFrame("message.received");
        assertThat(received.get("data").get("body").asText()).isEqualTo("bridged hello");
        assertThat(received.get("data").get("senderName").asText()).isEqualTo("Tg User");
        assertThat(received.get("data").get("timestamp").asText())
                .isEqualTo("2026-10-18T10:00:00Z");
        // The ops room (connector:telegram) is NOT a conversation-room member.
        assertThat(opsClient.nextFrame("message.received", 1)).isNull();

        // connector.status.changed → connector.status broadcast + status.updated
        // to the connector:{platform} room.
        opsSession.sendMessage(inbound("connector.status.changed", object()
                .put("platform", "telegram")
                .put("status", "reconnecting")
                .put("message", "reconnect scheduled")
                .put("timestamp", "2026-10-18T10:01:00Z")));
        JsonNode broadcast = conversationClient.nextFrame("connector.status");
        assertThat(broadcast.get("data").get("platform").asText()).isEqualTo("telegram");
        assertThat(broadcast.get("data").get("status").asText()).isEqualTo("reconnecting");
        assertThat(broadcast.get("data").get("message").asText())
                .isEqualTo("reconnect scheduled");
        JsonNode roomStatus = opsClient.nextFrame("status.updated");
        assertThat(roomStatus.get("data").get("status").asText()).isEqualTo("reconnecting");

        // connector.message.error → message.error to the conversation room.
        conversationSession.sendMessage(inbound("connector.message.error", object()
                .put("conversationId", CONVERSATION_ID)
                .put("messageId", UUID.randomUUID().toString())
                .put("platform", "telegram")
                .put("error", "send failed")
                .put("willRetry", true)
                .put("timestamp", "2026-10-18T10:02:00Z")));
        JsonNode error = conversationClient.nextFrame("message.error");
        assertThat(error.get("data").get("error").asText()).isEqualTo("send failed");
        assertThat(error.get("data").get("willRetry").asBoolean()).isTrue();

        // connector.message.ack → message.ack to the conversation room.
        conversationSession.sendMessage(inbound("connector.message.ack", object()
                .put("conversationId", CONVERSATION_ID)
                .put("messageId", UUID.randomUUID().toString())
                .put("platform", "telegram")
                .put("platformMessageId", "777")
                .put("timestamp", "2026-10-18T10:03:00Z")));
        JsonNode ack = conversationClient.nextFrame("message.ack");
        assertThat(ack.get("data").get("platformMessageId").asText()).isEqualTo("777");
        assertThat(ack.get("data").get("timestamp").asText())
                .isEqualTo("2026-10-18T10:03:00Z");

        // A malformed payload takes the existing system.error path (never a
        // silent drop).
        conversationSession.sendMessage(inbound("connector.message.error", object()
                .put("conversationId", CONVERSATION_ID)));
        JsonNode systemError = conversationClient.nextFrame("system.error");
        assertThat(systemError.get("data").get("error").get("code").asText())
                .isEqualTo("bad_frame");

        conversationSession.close();
        opsSession.close();
    }

    @Test
    void serverSideStatusTransitionsEmitAndResetTheBreaker() throws Exception {
        seedUsers();
        String token = accessToken(ALICE_ID);

        CollectingHandler opsClient = new CollectingHandler();
        WebSocketSession opsSession = connect(opsClient, token);
        opsClient.nextFrame("system.connection.established");
        opsSession.sendMessage(inbound("connector.subscribe",
                object().put("platform", "irc")));
        opsClient.nextFrame("connector.subscribed");

        // Five surfaced adapter failures open the platform breaker (MIG-063
        // threshold); the CONNECTED transition through the additive seam
        // resets it (G6 un-wedge) and emits both frozen status channels.
        for (int failure = 0; failure < 5; failure++) {
            breaker.recordFailure("irc");
        }
        assertThat(breaker.isOpen("irc")).isTrue();

        statusListener.onStatusChange("irc", ConnectorStatus.CONNECTED);

        JsonNode broadcast = opsClient.nextFrame("connector.status");
        assertThat(broadcast.get("data").get("platform").asText()).isEqualTo("irc");
        assertThat(broadcast.get("data").get("status").asText()).isEqualTo("connected");
        assertThat(broadcast.get("data").get("timestamp").asText()).isNotEmpty();
        JsonNode room = opsClient.nextFrame("status.updated");
        assertThat(room.get("data").get("status").asText()).isEqualTo("connected");
        assertThat(breaker.isOpen("irc")).isFalse();
        assertThat(breaker.failureCount("irc")).isZero();

        // The error transition carries the frozen `error` vocabulary member.
        statusListener.onStatusChange("irc", ConnectorStatus.ERROR);
        JsonNode errorBroadcast = opsClient.nextFrame("connector.status");
        assertThat(errorBroadcast.get("data").get("status").asText()).isEqualTo("error");

        opsSession.close();
    }

    // --- harness (MIG-051 realtime test conventions) ---

    private void seedUsers() {
        users.save(new User(ALICE_ID, "ws-bridge-a@fixture.yacc.local",
                "Bridge Fixture", "bridge-has-no-login", UserRole.USER,
                UserStatus.ACTIVE, false));
    }

    private String accessToken(String userId) {
        User user = users.findById(userId).orElseThrow();
        return jwtTokens.issueAccessToken(new AuthUser(user), "ws-bridge-grant");
    }

    private static com.fasterxml.jackson.databind.node.ObjectNode object() {
        return new ObjectMapper().createObjectNode();
    }

    private static com.fasterxml.jackson.databind.node.TextNode text(String value) {
        return new ObjectMapper().createObjectNode().textNode(value);
    }

    private static TextMessage inbound(String event, com.fasterxml.jackson.databind.JsonNode data) {
        com.fasterxml.jackson.databind.node.ObjectNode frame =
                new ObjectMapper().createObjectNode().put("event", event);
        frame.set("data", data);
        return new TextMessage(frame.toString());
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
                JsonNode frame = new ObjectMapper().readTree(payload);
                if (event.equals(frame.get("event").asText())) {
                    return frame;
                }
            }
            return null;
        }
    }
}
