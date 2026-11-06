package com.yacc.api.realtime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

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
 * MIG-050 end-to-end WS smoke over a real Tomcat upgrade (AC-MIG-050-1):
 * auth-on-handshake against the real Spring Security material (signed token,
 * ACTIVE-status enforcement) and the live transport contract — exactly one
 * enveloped {@code system.connection.established} frame per connect
 * (WS-EVT-014) and the {@code subscribe.conversation} room ack
 * (WS-OP-CONV-004). Unauthenticated or inactive identities are refused
 * before any session exists (WS-BHV-016).
 *
 * <p>Uses {@code RANDOM_PORT} so the upgrade runs through the actual servlet
 * container + filter chain + handshake interceptor. The test is deliberately
 * NOT {@code @Transactional}: the WS server threads authenticate outside the
 * test transaction, so seeds commit directly (fixed UUIDs keep reruns
 * idempotent, mirroring the shared-container conventions).</p>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class RealtimeWebSocketIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final String ACTIVE_USER_ID = "00000000-0000-0000-0000-00000000c050";
    private static final String INACTIVE_USER_ID = "00000000-0000-0000-0000-00000000c051";
    private static final String SUSPENDED_USER_ID = "00000000-0000-0000-0000-00000000c052";
    private static final String ROLE_SUPER_ID = "00000000-0000-0000-0000-00000000c060";
    private static final String ROLE_ADMIN_ID = "00000000-0000-0000-0000-00000000c061";
    private static final String ROLE_MANAGER_ID = "00000000-0000-0000-0000-00000000c062";
    private static final String ROLE_USER_ID = "00000000-0000-0000-0000-00000000c063";

    @org.springframework.boot.test.web.server.LocalServerPort
    private int port;

    @Autowired
    private UserRepository users;

    @Autowired
    private JwtTokenService jwtTokens;

    @Autowired
    private ObjectMapper mapper;

    /**
     * Removes exactly the smoke identities this class commits directly (see
     * class javadoc — deliberately not {@code @Transactional}), so the
     * shared test database does not carry this class's rows after it runs.
     * {@code DeterministicSeedIntegrationTest} asserts an exact
     * {@code hasSize(4)} against the same shared container; the order
     * coupling between the two classes pre-dated MIG-101 and was only
     * surfaced by the package relocation's mandated renames. Reruns stay
     * idempotent.
     */
    @org.junit.jupiter.api.AfterAll
    static void removeCommittedSmokeIdentities(
            @org.springframework.beans.factory.annotation.Autowired com.yacc.repository.UserRepository users) {
        users.deleteAllById(java.util.List.of(ACTIVE_USER_ID, INACTIVE_USER_ID,
                SUSPENDED_USER_ID, ROLE_SUPER_ID, ROLE_ADMIN_ID, ROLE_MANAGER_ID,
                ROLE_USER_ID));
    }

    @Test
    void authenticatedUpgradeReceivesEstablishedEventAndConversationAck() throws Exception {
        seedUser(ACTIVE_USER_ID, UserStatus.ACTIVE);
        String token = accessToken(ACTIVE_USER_ID);

        CollectingHandler handler = new CollectingHandler();
        WebSocketSession session = connect(handler, token);

        JsonNode established = handler.nextFrame();
        assertThat(established.get("event").asText()).isEqualTo("system.connection.established");
        assertThat(established.get("data").get("type").asText())
                .isEqualTo("connection_established");
        assertThat(established.get("timestamp").asText()).isNotEmpty();

        session.sendMessage(new TextMessage(
                "{\"event\":\"subscribe.conversation\",\"data\":\"conv-smoke-1\"}"));
        JsonNode ack = handler.nextFrame();
        assertThat(ack.get("event").asText()).isEqualTo("conversation.subscribed");
        assertThat(ack.get("data").get("conversationId").asText()).isEqualTo("conv-smoke-1");

        session.close();
    }

    @Test
    void upgradeWithoutTokenIsRefused() {
        seedUser(ACTIVE_USER_ID, UserStatus.ACTIVE);

        assertThatThrownBy(() -> connect(new CollectingHandler(), null))
                .isInstanceOf(Exception.class);
    }

    @Test
    void upgradeWithGarbageTokenIsRefused() {
        assertThatThrownBy(() -> connect(new CollectingHandler(), "not-a-jwt"))
                .isInstanceOf(Exception.class);
    }

    @Test
    void upgradeWithInactiveIdentityTokenIsRefused() {
        seedUser(INACTIVE_USER_ID, UserStatus.INACTIVE);
        String token = accessToken(INACTIVE_USER_ID);

        assertThatThrownBy(() -> connect(new CollectingHandler(), token))
                .isInstanceOf(Exception.class);
    }

    /**
     * AC-11 status axis (issue #457): the suspended-identity counterpart of
     * the inactive refusal, through the same full upgrade path — the
     * handshake seam refuses the session before any WS op can be issued
     * (WS-BHV-016).
     */
    @Test
    void upgradeWithSuspendedIdentityTokenIsRefused() {
        seedUser(SUSPENDED_USER_ID, UserStatus.SUSPENDED);
        String token = accessToken(SUSPENDED_USER_ID);

        assertThatThrownBy(() -> connect(new CollectingHandler(), token))
                .isInstanceOf(Exception.class);
    }

    /**
     * AC-11 role axis of the WS surface (issue #457): every active role is
     * admitted by the handshake and reaches the established frame — the
     * accepted model gates WS ops on authentication+status only, with no
     * per-op role gate (matrix §4).
     */
    @Test
    void upgradeAdmitsEveryActiveRole() throws Exception {
        java.util.List<String> ids = java.util.List.of(ROLE_SUPER_ID, ROLE_ADMIN_ID,
                ROLE_MANAGER_ID, ROLE_USER_ID);
        java.util.List<UserRole> roles = java.util.List.of(UserRole.SUPER_ADMIN,
                UserRole.ADMIN, UserRole.MANAGER, UserRole.USER);
        for (int i = 0; i < ids.size(); i++) {
            String id = ids.get(i);
            users.save(new User(id, "ws-smoke-" + id + "@fixture.yacc.local",
                    "WS Role " + roles.get(i).getLabel(), "smoke-has-no-login",
                    roles.get(i), UserStatus.ACTIVE, false));
        }
        for (String id : ids) {
            CollectingHandler handler = new CollectingHandler();
            WebSocketSession session = connect(handler, accessToken(id));
            assertThat(handler.nextFrame().get("event").asText())
                    .isEqualTo("system.connection.established");
            session.close();
        }
    }

    private void seedUser(String id, UserStatus status) {
        users.save(new User(id, "ws-smoke-" + id + "@fixture.yacc.local",
                "WS Smoke " + status.getLabel(), "smoke-has-no-login", UserRole.USER,
                status, false));
    }

    private String accessToken(String userId) {
        User user = users.findById(userId).orElseThrow();
        return jwtTokens.issueAccessToken(new AuthUser(user), "ws-smoke-grant");
    }

    private WebSocketSession connect(CollectingHandler handler, String token) throws Exception {
        StandardWebSocketClient client = new StandardWebSocketClient();
        URI uri = URI.create("ws://localhost:" + port + "/ws"
                + (token == null ? "" : "?token=" + token));
        CompletableFuture<WebSocketSession> future =
                client.execute(handler, new WebSocketHttpHeaders(), uri);
        return future.get(10, TimeUnit.SECONDS);
    }

    /**
     * Collects inbound frames; {@code nextFrame} bounds every wait so a
     * missing frame fails the test instead of hanging the run.
     */
    private static class CollectingHandler extends TextWebSocketHandler {

        private final LinkedBlockingQueue<String> frames = new LinkedBlockingQueue<>();

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            frames.add(message.getPayload());
        }

        JsonNode nextFrame() throws Exception {
            String payload = frames.poll(10, TimeUnit.SECONDS);
            assertThat(payload).as("expected a WS frame within the timeout").isNotNull();
            return new ObjectMapper().readTree(payload);
        }
    }
}
