package com.yacc.api.realtime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * The routing/emission half of the nine frozen inbound application operations
 * (MIG-091a; ledger WS-OP-CONV-003, WS-OP-MSG-001..004, WS-OP-REACT-001..004
 * and their raw emissions WS-RAW-004/005/014/015/016). The raw-WS handler
 * ({@link YaccWebSocketHandler}) routes the frozen channel names here; every
 * relay validates the frozen bare publish payload (required members, the
 * {@code sent|failed} status constants, the 1..3 attempt ladder, integral
 * count) and produces the frozen enveloped emissions through the single
 * publish path — room fan-outs via the NO-BACKLOG
 * {@link WebSocketEventPublisher#fanOutToRoom} primitive (baseline
 * {@code socket.to(room).emit} parity: never stored for replay) and
 * sender-directed acks via {@code publishToSession} (never backlogged):
 *
 * <ul>
 *   <li>{@code conversation.updated} &rarr; payload passed through to the
 *       {@code conversation:{id}} room except the sender;</li>
 *   <li>{@code message.sent} / {@code message.failed} &rarr; payload passed
 *       through to the room except the sender;</li>
 *   <li>{@code message.retry} &rarr; sender ack {@code message.retry.acknowledged}
 *       + room broadcast {@code message.retry.started} (relay-exact: ack +
 *       broadcast only — no dispatch, no state change; the once-only retry
 *       execution stays {@code MessageService.retry} via REST-MSG-003);</li>
 *   <li>{@code message.received.ack} &rarr; debug log only — no emission, no
 *       error reply (baseline optional tracking, error-swallowing preserved);</li>
 *   <li>{@code reaction.added} / {@code reaction.removed} &rarr; payload
 *       passed through to the room except the sender + sender ack;</li>
 *   <li>{@code reaction.list} &rarr; sender reply {@code reaction.list.ack}
 *       with {@code reactions: []} (baseline no-DB behavior);</li>
 *   <li>{@code reaction.count} &rarr; regenerated-timestamp count fan-out to
 *       the room except the sender.</li>
 * </ul>
 *
 * <p>A malformed payload throws {@link IllegalArgumentException} naming the
 * member — the handler maps it to the existing {@code system.error} path
 * (never a silent drop, guardrail G4). {@code timestamp} members on acks and
 * regenerated payloads are server-generated at emit time (baseline
 * {@code new Date().toISOString()} parity, RFC 3339).</p>
 */
@Service
public class ApplicationEventRelayService {

    private static final Logger log = LoggerFactory.getLogger(ApplicationEventRelayService.class);

    private static final String STATUS_SENT = "sent";

    private static final String STATUS_FAILED = "failed";

    private static final int ATTEMPT_MIN = 1;

    private static final int ATTEMPT_MAX = 3;

    private final WebSocketEventPublisher publisher;

    private final ObjectMapper mapper;

    public ApplicationEventRelayService(WebSocketEventPublisher publisher, ObjectMapper mapper) {
        this.publisher = publisher;
        this.mapper = mapper;
    }

    /** {@code conversation.updated} → room fan-out except sender (verbatim). */
    public void relayConversationUpdated(WebSocketSession session, JsonNode payload) {
        requireText(payload, "conversationId");
        requireObject(payload, "updatedFields");
        requireText(payload, "changedBy");
        requireText(payload, "changedAt");
        fanOut(session, payload.get("conversationId").asText(),
                RealtimeEvents.CONVERSATION_UPDATED, payload);
    }

    /** {@code message.sent} → room fan-out except sender (verbatim). */
    public void relayMessageSent(WebSocketSession session, JsonNode payload) {
        requireText(payload, "messageId");
        requireText(payload, "conversationId");
        requireStatus(payload, STATUS_SENT);
        requireText(payload, "sentAt");
        fanOut(session, payload.get("conversationId").asText(),
                RealtimeEvents.MESSAGE_SENT, payload);
    }

    /** {@code message.failed} → room fan-out except sender (verbatim). */
    public void relayMessageFailed(WebSocketSession session, JsonNode payload) {
        requireText(payload, "messageId");
        requireText(payload, "conversationId");
        requireStatus(payload, STATUS_FAILED);
        requireText(payload, "error");
        requireText(payload, "retryAt");
        requireAttempt(payload);
        fanOut(session, payload.get("conversationId").asText(),
                RealtimeEvents.MESSAGE_FAILED, payload);
    }

    /**
     * {@code message.retry} → sender ack {@code message.retry.acknowledged} +
     * room broadcast {@code message.retry.started} except the sender.
     * Relay-exact (G2): ack + broadcast only — no queue dispatch, no state
     * change.
     */
    public void relayMessageRetry(WebSocketSession session, JsonNode payload) {
        requireText(payload, "messageId");
        requireText(payload, "conversationId");
        String messageId = payload.get("messageId").asText();
        String conversationId = payload.get("conversationId").asText();

        ObjectNode ack = mapper.createObjectNode().put("messageId", messageId);
        ack.put("timestamp", now());
        publisher.publishToSession(session, WebSocketEnvelope.of(
                RealtimeEvents.MESSAGE_RETRY_ACKNOWLEDGED, ack));

        ObjectNode started = mapper.createObjectNode()
                .put("messageId", messageId)
                .put("conversationId", conversationId)
                .put("timestamp", now());
        fanOut(session, conversationId, RealtimeEvents.MESSAGE_RETRY_STARTED, started);
    }

    /**
     * {@code message.received.ack} → optional tracking: debug log only, no
     * emission, no error reply — every failure swallowed (baseline parity,
     * ledger WS-OP-MSG-004).
     */
    public void relayMessageReceivedAck(JsonNode payload) {
        try {
            log.debug("Client acknowledged message received (messageId={}, conversationId={})",
                    textOrNull(payload, "messageId"), textOrNull(payload, "conversationId"));
        } catch (RuntimeException swallowed) {
            log.debug("message.received.ack handling dropped: {}", swallowed.getMessage());
        }
    }

    /** {@code reaction.added} → room fan-out except sender + sender ack. */
    public void relayReactionAdded(WebSocketSession session, JsonNode payload) {
        requireText(payload, "messageId");
        requireText(payload, "conversationId");
        requireText(payload, "emoji");
        requireText(payload, "userId");
        requireText(payload, "name");
        fanOut(session, payload.get("conversationId").asText(),
                RealtimeEvents.REACTION_ADDED, payload);
        ObjectNode ack = mapper.createObjectNode()
                .put("messageId", payload.get("messageId").asText())
                .put("emoji", payload.get("emoji").asText())
                .put("timestamp", now());
        publisher.publishToSession(session, WebSocketEnvelope.of(
                RealtimeEvents.REACTION_ADDED_ACK, ack));
    }

    /** {@code reaction.removed} → room fan-out except sender + sender ack. */
    public void relayReactionRemoved(WebSocketSession session, JsonNode payload) {
        requireText(payload, "messageId");
        requireText(payload, "conversationId");
        requireText(payload, "emoji");
        requireText(payload, "userId");
        fanOut(session, payload.get("conversationId").asText(),
                RealtimeEvents.REACTION_REMOVED, payload);
        ObjectNode ack = mapper.createObjectNode()
                .put("messageId", payload.get("messageId").asText())
                .put("emoji", payload.get("emoji").asText())
                .put("timestamp", now());
        publisher.publishToSession(session, WebSocketEnvelope.of(
                RealtimeEvents.REACTION_REMOVED_ACK, ack));
    }

    /**
     * {@code reaction.list} → sender reply {@code reaction.list.ack} with
     * {@code reactions: []} (baseline no-DB behavior; MIG-003 canonicalized
     * list semantics).
     */
    public void relayReactionList(WebSocketSession session, JsonNode payload) {
        requireText(payload, "messageId");
        ObjectNode reply = mapper.createObjectNode()
                .put("messageId", payload.get("messageId").asText());
        reply.set("reactions", mapper.createArrayNode());
        reply.put("timestamp", now());
        publisher.publishToSession(session, WebSocketEnvelope.of(
                RealtimeEvents.REACTION_LIST_ACK, reply));
    }

    /**
     * {@code reaction.count} → room fan-out of the regenerated count payload
     * (baseline rebuilds the object with a fresh timestamp) except the sender.
     */
    public void relayReactionCount(WebSocketSession session, JsonNode payload) {
        requireText(payload, "messageId");
        requireText(payload, "conversationId");
        requireText(payload, "emoji");
        requireIntegral(payload, "count");
        ObjectNode count = mapper.createObjectNode()
                .put("messageId", payload.get("messageId").asText())
                .put("emoji", payload.get("emoji").asText())
                .put("count", payload.get("count").asInt())
                .put("timestamp", now());
        fanOut(session, payload.get("conversationId").asText(),
                RealtimeEvents.REACTION_COUNT, count);
    }

    // --- emission targets (single publish path; no-backlog fan-out) ---

    private void fanOut(WebSocketSession session, String conversationId, String event,
            JsonNode payload) {
        publisher.fanOutToRoom(RealtimeRooms.conversation(conversationId), session.getId(),
                WebSocketEnvelope.of(event, payload));
    }

    private static String now() {
        return java.time.Instant.now().toString();
    }

    // --- frozen bare-payload validation (G4; member-naming errors) ---

    private static void requireText(JsonNode payload, String member) {
        if (payload == null || !payload.hasNonNull(member)
                || payload.get(member).asText().isBlank()) {
            throw new IllegalArgumentException(member + " is required");
        }
    }

    private static void requireObject(JsonNode payload, String member) {
        if (payload == null || !payload.hasNonNull(member) || !payload.get(member).isObject()) {
            throw new IllegalArgumentException(member + " must be an object");
        }
    }

    private static void requireStatus(JsonNode payload, String expected) {
        requireText(payload, "status");
        if (!expected.equals(payload.get("status").asText())) {
            throw new IllegalArgumentException("status must be " + expected);
        }
    }

    private static void requireAttempt(JsonNode payload) {
        requireIntegral(payload, "attempt");
        int attempt = payload.get("attempt").asInt();
        if (attempt < ATTEMPT_MIN || attempt > ATTEMPT_MAX) {
            throw new IllegalArgumentException("attempt must be between "
                    + ATTEMPT_MIN + " and " + ATTEMPT_MAX);
        }
    }

    private static void requireIntegral(JsonNode payload, String member) {
        if (payload == null || !payload.hasNonNull(member)
                || !payload.get(member).isIntegralNumber()) {
            throw new IllegalArgumentException(member + " must be an integer");
        }
    }

    private static String textOrNull(JsonNode payload, String member) {
        return payload == null || !payload.hasNonNull(member) ? null
                : payload.get(member).asText();
    }
}
