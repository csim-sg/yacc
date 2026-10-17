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
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.api.auth.AuthUser;
import com.yacc.entity.User;
import com.yacc.entity.UserRole;
import com.yacc.entity.UserStatus;
import com.yacc.repository.UserRepository;
import com.yacc.service.JwtTokenService;
import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;

/**
 * MIG-051 presence/typing behavior over real sockets (AC-MIG-051-2; ledger
 * WS-EVT-009..013, WS-OP-PRES-001..005, WS-OP-TYPE-001..004, WS-RAW-006/007,
 * WS-BHV-014/015): inbound {@code user.online} broadcasts the canonical
 * {@code presence.updated} and replies {@code online.users}; typing fan-out
 * reaches the conversation room except the sender; {@code typing.timeout}
 * clears the indicator; {@code user.status} broadcasts the granular
 * {@code user.status.changed}; {@code request.online.users} replies; and the
 * server-observed last-socket-off disconnect broadcasts the offline
 * presence. Every outbound frame is enveloped (MIG-003 §4.1).
 *
 * <p>Deliberately NOT {@code @Transactional}; this class removes exactly its
 * own fixed-UUID rows in {@code @AfterAll} (shared-container conventions).</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class WebSocketPresenceTypingIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ALICE_ID = "00000000-0000-0000-0000-00000000c061";
    private static final String BOB_ID = "00000000-0000-0000-0000-00000000c062";
    private static final String CONVERSATION_ID = "00000000-0000-0000-0000-00000000c098";

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
        users.deleteAllById(java.util.List.of(ALICE_ID, BOB_ID));
    }

    @Test
    void presenceAndTypingFlowBetweenTwoRealSessions() throws Exception {
        seedUsers();
        String aliceToken = accessToken(ALICE_ID);
        String bobToken = accessToken(BOB_ID);

        CollectingHandler alice = new CollectingHandler();
        CollectingHandler bob = new CollectingHandler();
        WebSocketSession aliceSession = connect(alice, aliceToken);
        WebSocketSession bobSession = connect(bob, bobToken);
        alice.nextFrame("system.connection.established");
        bob.nextFrame("system.connection.established");

        bobSession.sendMessage(inbound("subscribe.conversation", text(CONVERSATION_ID)));
        bob.nextFrame("conversation.subscribed");

        // user.online: broadcast presence.updated (canonical) + online.users reply.
        aliceSession.sendMessage(inbound("user.online", object()
                .put("userId", ALICE_ID).put("name", "Alice")));
        JsonNode onlinePresence = bob.nextFrame("presence.updated");
        assertThat(onlinePresence.get("data").get("userId").asText()).isEqualTo(ALICE_ID);
        assertThat(onlinePresence.get("data").get("status").asText()).isEqualTo("online");
        assertThat(onlinePresence.get("data").get("lastSeen").asText()).endsWith("Z");
        JsonNode onlineUsers = alice.nextFrame("online.users");
        assertThat(onlineUsers.get("data").get("users").toString())
                .contains(ALICE_ID, BOB_ID);

        // typing.started: room fan-out except the sender (Alice not subscribed;
        // Bob receives, Alice does not).
        aliceSession.sendMessage(inbound("typing.started", object()
                .put("conversationId", CONVERSATION_ID)
                .put("userId", ALICE_ID).put("name", "Alice")));
        JsonNode typingStarted = bob.nextFrame("typing.started");
        assertThat(typingStarted.get("data").get("name").asText()).isEqualTo("Alice");
        assertThat(alice.nextFrame("typing.started", 1)).isNull();

        // typing.timeout: the timeout path clears the indicator (typing.stopped).
        aliceSession.sendMessage(inbound("typing.timeout", object()
                .put("conversationId", CONVERSATION_ID).put("userId", ALICE_ID)));
        assertThat(bob.nextFrame("typing.stopped").get("data").get("userId").asText())
                .isEqualTo(ALICE_ID);

        // user.status: granular broadcast except the sender.
        aliceSession.sendMessage(inbound("user.status", object()
                .put("userId", ALICE_ID).put("status", "away")));
        JsonNode statusChanged = bob.nextFrame("user.status.changed");
        assertThat(statusChanged.get("data").get("status").asText()).isEqualTo("away");
        assertThat(statusChanged.get("data").get("timestamp").asText()).isNotEmpty();

        // inbound presence.updated: canonical echo to the others, not the sender.
        bobSession.sendMessage(inbound("presence.updated", object()
                .put("userId", BOB_ID).put("status", "offline")
                .put("lastSeen", "2026-10-17T10:00:00Z")));
        JsonNode relayed = alice.nextFrame("presence.updated");
        assertThat(relayed.get("data").get("userId").asText()).isEqualTo(BOB_ID);
        assertThat(relayed.get("data").get("status").asText()).isEqualTo("offline");
        assertThat(bob.nextFrame("presence.updated", 1)).isNull();

        // request.online.users: reply to the requesting session.
        aliceSession.sendMessage(inbound("request.online.users", nullNode()));
        assertThat(alice.nextFrame("online.users").get("data").get("users"))
                .hasSize(2);

        // Server-observed last-socket-off disconnect: offline broadcast.
        bobSession.close();
        JsonNode offline = alice.nextFrame("presence.updated");
        assertThat(offline.get("data").get("userId").asText()).isEqualTo(BOB_ID);
        assertThat(offline.get("data").get("status").asText()).isEqualTo("offline");

        aliceSession.close();
    }

    // --- helpers ---

    private User seedUsers() {
        users.save(new User(ALICE_ID, "ws-presence-a@fixture.yacc.local",
                "Alice Fixture", "alice-has-no-login", UserRole.USER, UserStatus.ACTIVE,
                false));
        return users.save(new User(BOB_ID, "ws-presence-b@fixture.yacc.local",
                "Bob Fixture", "bob-has-no-login", UserRole.USER, UserStatus.ACTIVE,
                false));
    }

    private String accessToken(String userId) {
        User user = users.findById(userId).orElseThrow();
        return jwtTokens.issueAccessToken(new AuthUser(user), "ws-presence-grant");
    }

    private static com.fasterxml.jackson.databind.node.ObjectNode object() {
        return new ObjectMapper().createObjectNode();
    }

    private static com.fasterxml.jackson.databind.node.TextNode text(String value) {
        return new ObjectMapper().createObjectNode().textNode(value);
    }

    private static com.fasterxml.jackson.databind.node.NullNode nullNode() {
        return com.fasterxml.jackson.databind.node.NullNode.getInstance();
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
