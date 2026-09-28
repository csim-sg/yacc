package com.yacc.realtime.service;

import java.io.IOException;
import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.realtime.model.RealtimeEvents;
import com.yacc.realtime.model.RealtimeRooms;
import com.yacc.realtime.model.RealtimeSession;
import com.yacc.realtime.model.SystemEventPayload;
import com.yacc.realtime.model.WebSocketEnvelope;
import com.yacc.realtime.model.WebSocketInboundFrame;

/**
 * The raw WebSocket handler (MIG-050; ADR-026; TR-04) — the one transport
 * handler replacing the six Socket.io socket controllers. Owns:
 *
 * <ul>
 *   <li>registration of the authenticated session (identity attached by
 *       {@link WebSocketHandshakeAuthInterceptor}) and the connect-time
 *       personal-room join ({@code user:{userId}}, WS-BHV-006);</li>
 *   <li>the ONE connect-time {@code system.connection.established} emission
 *       (WS-EVT-014 — the baseline duplicate connect path is deduped);</li>
 *   <li>inbound room management — {@code subscribe.conversation},
 *       {@code unsubscribe.conversation}, {@code connector.subscribe},
 *       {@code connector.unsubscribe} — with the frozen bare-payload acks
 *       ({@code conversation.subscribed}/{@code ...unsubscribed} with
 *       {@code {conversationId}}; {@code connector.subscribed}/
 *       {@code ...unsubscribed} with {@code {platform,timestamp}});</li>
 *   <li>the {@code system.error} error path (WS-EVT-018) for malformed
 *       frames, unknown channels, and transport faults;</li>
 *   <li>registry cleanup on close (idempotent).</li>
 * </ul>
 *
 * <p>Heartbeat, presence/typing, backlog replay, and reconnect semantics are
 * application-owned behaviors that arrive with MIG-051 — this handler is the
 * transport they build on (ADR-026).</p>
 */
@Component
public class YaccWebSocketHandler extends TextWebSocketHandler {

    /** Error code of the {@code system.error} frame for unknown channels. */
    static final String ERROR_CODE_UNKNOWN_EVENT = "unknown_event";

    /** Error code of the {@code system.error} frame for malformed frames. */
    static final String ERROR_CODE_BAD_FRAME = "bad_frame";

    /** Error code of the {@code system.error} frame for transport faults. */
    static final String ERROR_CODE_TRANSPORT = "transport_error";

    private final WebSocketSessionRegistry registry;

    private final WebSocketEventPublisher publisher;

    private final ObjectMapper mapper;

    public YaccWebSocketHandler(WebSocketSessionRegistry registry,
            WebSocketEventPublisher publisher, ObjectMapper mapper) {
        this.registry = registry;
        this.publisher = publisher;
        this.mapper = mapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        RealtimeSession handshake = identityOf(session);
        RealtimeSession identity = new RealtimeSession(session.getId(), handshake.userId(),
                handshake.email(), handshake.role(), handshake.name());
        registry.register(identity, session);
        registry.joinRoom(identity.sessionId(), RealtimeRooms.user(identity.userId()));
        // ONE connect-time emit of the contract event (WS-EVT-014; the raw
        // baseline literal and its duplicate path are retired by MIG-003 §4.3).
        publisher.publishToSession(session, WebSocketEnvelope.of(
                RealtimeEvents.SYSTEM_CONNECTION_ESTABLISHED,
                mapper.valueToTree(SystemEventPayload.of(
                        SystemEventPayload.TYPE_CONNECTION_ESTABLISHED))));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        WebSocketInboundFrame frame = parse(session, message.getPayload());
        if (frame == null) {
            return; // system.error already emitted by parse failure.
        }
        RealtimeSession identity = registry.identity(session.getId()).orElse(null);
        if (identity == null) {
            emitError(session, ERROR_CODE_TRANSPORT, "Unregistered session");
            return;
        }
        switch (frame.event()) {
            case RealtimeEvents.SUBSCRIBE_CONVERSATION ->
                    subscribeConversation(session, identity, frame.data());
            case RealtimeEvents.UNSUBSCRIBE_CONVERSATION ->
                    unsubscribeConversation(session, identity, frame.data());
            case RealtimeEvents.CONNECTOR_SUBSCRIBE ->
                    connectorSubscribe(session, identity, frame.data());
            case RealtimeEvents.CONNECTOR_UNSUBSCRIBE ->
                    connectorUnsubscribe(session, identity, frame.data());
            default -> emitError(session, ERROR_CODE_UNKNOWN_EVENT,
                    "Unknown event: " + frame.event());
        }
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        emitError(session, ERROR_CODE_TRANSPORT, "Transport error");
        try {
            session.close(CloseStatus.SERVER_ERROR);
        } catch (IOException e) {
            // Close failure on an already-broken transport — nothing to do.
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        registry.unregister(session.getId());
    }

    // --- Frozen inbound channels (bare payloads; acks per AsyncAPI) ---

    /** subscribe.conversation: bare conversationId string → join + ack. */
    private void subscribeConversation(WebSocketSession session, RealtimeSession identity,
            JsonNode data) {
        String conversationId = textBody(data);
        if (conversationId == null) {
            emitError(session, ERROR_CODE_BAD_FRAME, "conversationId is required");
            return;
        }
        registry.joinRoom(identity.sessionId(), RealtimeRooms.conversation(conversationId));
        ObjectNode ack = mapper.createObjectNode().put("conversationId", conversationId);
        publisher.publishToSession(session, WebSocketEnvelope.of(
                RealtimeEvents.CONVERSATION_SUBSCRIBED, ack));
    }

    /** unsubscribe.conversation: bare conversationId string → leave + ack. */
    private void unsubscribeConversation(WebSocketSession session, RealtimeSession identity,
            JsonNode data) {
        String conversationId = textBody(data);
        if (conversationId == null) {
            emitError(session, ERROR_CODE_BAD_FRAME, "conversationId is required");
            return;
        }
        registry.leaveRoom(identity.sessionId(), RealtimeRooms.conversation(conversationId));
        ObjectNode ack = mapper.createObjectNode().put("conversationId", conversationId);
        publisher.publishToSession(session, WebSocketEnvelope.of(
                RealtimeEvents.CONVERSATION_UNSUBSCRIBED, ack));
    }

    /** connector.subscribe: {platform} → join + ack {platform,timestamp}. */
    private void connectorSubscribe(WebSocketSession session, RealtimeSession identity,
            JsonNode data) {
        String platform = platformOf(data);
        if (platform == null) {
            emitError(session, ERROR_CODE_BAD_FRAME, "platform is required");
            return;
        }
        registry.joinRoom(identity.sessionId(), RealtimeRooms.connector(platform));
        publisher.publishToSession(session, WebSocketEnvelope.of(
                RealtimeEvents.CONNECTOR_SUBSCRIBED, connectorAck(platform)));
    }

    /** connector.unsubscribe: {platform} → leave + ack {platform,timestamp}. */
    private void connectorUnsubscribe(WebSocketSession session, RealtimeSession identity,
            JsonNode data) {
        String platform = platformOf(data);
        if (platform == null) {
            emitError(session, ERROR_CODE_BAD_FRAME, "platform is required");
            return;
        }
        registry.leaveRoom(identity.sessionId(), RealtimeRooms.connector(platform));
        publisher.publishToSession(session, WebSocketEnvelope.of(
                RealtimeEvents.CONNECTOR_UNSUBSCRIBED, connectorAck(platform)));
    }

    // --- Helpers ---

    private WebSocketInboundFrame parse(WebSocketSession session, String payload) {
        try {
            WebSocketInboundFrame frame = mapper.readValue(payload, WebSocketInboundFrame.class);
            if (frame.event() == null || frame.event().isBlank()) {
                emitError(session, ERROR_CODE_BAD_FRAME, "Missing event channel");
                return null;
            }
            return frame;
        } catch (JsonProcessingException e) {
            emitError(session, ERROR_CODE_BAD_FRAME, "Malformed frame");
            return null;
        }
    }

    private static RealtimeSession identityOf(WebSocketSession session) {
        RealtimeSession handshake = (RealtimeSession) session.getAttributes()
                .get(WebSocketHandshakeAuthInterceptor.IDENTITY_ATTRIBUTE);
        if (handshake == null) {
            // The interceptor denies unauthenticated upgrades; reaching here
            // without an identity means a mis-wired endpoint — fail closed.
            throw new IllegalStateException("WS session without handshake identity");
        }
        return handshake;
    }

    private static String textBody(JsonNode data) {
        return data == null || !data.isTextual() || data.asText().isBlank()
                ? null
                : data.asText();
    }

    private static String platformOf(JsonNode data) {
        if (data == null || !data.hasNonNull("platform")) {
            return null;
        }
        String platform = data.get("platform").asText();
        return List.of("telegram", "irc").contains(platform) ? platform : null;
    }

    private ObjectNode connectorAck(String platform) {
        ObjectNode ack = mapper.createObjectNode().put("platform", platform);
        ack.put("timestamp", java.time.Instant.now().toString());
        return ack;
    }

    private void emitError(WebSocketSession session, String code, String message) {
        publisher.publishToSession(session, WebSocketEnvelope.of(
                RealtimeEvents.SYSTEM_ERROR,
                mapper.valueToTree(SystemEventPayload.error(code, message))));
    }
}
