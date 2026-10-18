package com.yacc.api.realtime;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.api.realtime.RealtimeEvents;
import com.yacc.api.realtime.RealtimeRooms;
import com.yacc.api.realtime.WebSocketEnvelope;
import com.yacc.api.realtime.WebSocketEventPublisher;

/**
 * The routing/emission half of the four remaining frozen inbound connector
 * ops (MIG-062 D6; ledger WS-OP-CONN-001/002/005/006, WS-RAW-008/009/012/013,
 * WS-BHV-008). The raw-WS handler ({@link YaccWebSocketHandler}) routes the
 * frozen channel names here; every relay validates the frozen bare publish
 * payload (required members, {@code telegram|irc} platform, the
 * {@code connected|disconnected|error|reconnecting} status vocabulary) and
 * produces the frozen enveloped emissions through the single emit path:
 *
 * <ul>
 *   <li>{@code connector.message.received} &rarr; {@code message.received}
 *       to the {@code conversation:{id}} room (baseline
 *       {@code socket.to(room).emit} parity, payload passed through);</li>
 *   <li>{@code connector.status.changed} &rarr; {@code connector.status}
 *       broadcast + {@code status.updated} to the {@code connector:{platform}}
 *       room (baseline broadcast/room parity);</li>
 *   <li>{@code connector.message.error} &rarr; {@code message.error} to the
 *       conversation room ({@code willRetry} preserved);</li>
 *   <li>{@code connector.message.ack} &rarr; {@code message.ack} to the
 *       conversation room ({@code platformMessageId} preserved).</li>
 * </ul>
 *
 * <p>A malformed payload throws {@link IllegalArgumentException} — the
 * handler maps it to the existing {@code system.error} path (never a silent
 * drop, guardrail G3).</p>
 */
@Service
public class ConnectorRelayService {

    private static final java.util.List<String> PLATFORMS = java.util.List.of("telegram", "irc");

    private static final java.util.List<String> STATUS_VOCABULARY =
            java.util.List.of("connected", "disconnected", "error", "reconnecting");

    private final WebSocketEventPublisher publisher;

    private final ObjectMapper mapper;

    public ConnectorRelayService(WebSocketEventPublisher publisher, ObjectMapper mapper) {
        this.publisher = publisher;
        this.mapper = mapper;
    }

    /** {@code connector.message.received} → message.received (conversation room). */
    public void relayMessageReceived(JsonNode payload) {
        requireText(payload, "conversationId");
        requireText(payload, "messageId");
        requirePlatform(payload);
        requireText(payload, "senderId");
        requireText(payload, "senderName");
        requireText(payload, "body");
        requireText(payload, "timestamp");
        publisher.publishToRoom(
                RealtimeRooms.conversation(payload.get("conversationId").asText()),
                WebSocketEnvelope.of(RealtimeEvents.MESSAGE_RECEIVED, payload));
    }

    /**
     * {@code connector.status.changed} → connector.status broadcast +
     * status.updated to the {@code connector:{platform}} room.
     */
    public void relayStatusChanged(JsonNode payload) {
        requirePlatform(payload);
        requireText(payload, "status");
        if (!STATUS_VOCABULARY.contains(payload.get("status").asText())) {
            throw new IllegalArgumentException("Unknown connector status: "
                    + payload.get("status").asText());
        }
        requireText(payload, "timestamp");
        String platform = payload.get("platform").asText();
        String status = payload.get("status").asText();
        String timestamp = payload.get("timestamp").asText();
        ObjectNode broadcast = mapper.createObjectNode()
                .put("platform", platform)
                .put("status", status);
        copyIfPresent(payload, "message", broadcast);
        broadcast.put("timestamp", timestamp);
        publisher.publishToAll(WebSocketEnvelope.of(RealtimeEvents.CONNECTOR_STATUS, broadcast));
        ObjectNode room = mapper.createObjectNode().put("status", status);
        copyIfPresent(payload, "message", room);
        room.put("timestamp", timestamp);
        publisher.publishToRoom(RealtimeRooms.connector(platform),
                WebSocketEnvelope.of(RealtimeEvents.STATUS_UPDATED, room));
    }

    /** {@code connector.message.error} → message.error (conversation room). */
    public void relayMessageError(JsonNode payload) {
        requireText(payload, "conversationId");
        requireText(payload, "messageId");
        requirePlatform(payload);
        requireText(payload, "error");
        if (payload.get("willRetry") == null || !payload.get("willRetry").isBoolean()) {
            throw new IllegalArgumentException("willRetry is required");
        }
        requireText(payload, "timestamp");
        ObjectNode emission = mapper.createObjectNode()
                .put("messageId", payload.get("messageId").asText())
                .put("error", payload.get("error").asText())
                .put("willRetry", payload.get("willRetry").asBoolean())
                .put("timestamp", payload.get("timestamp").asText());
        publisher.publishToRoom(
                RealtimeRooms.conversation(payload.get("conversationId").asText()),
                WebSocketEnvelope.of(RealtimeEvents.MESSAGE_ERROR, emission));
    }

    /** {@code connector.message.ack} → message.ack (conversation room). */
    public void relayMessageAck(JsonNode payload) {
        requireText(payload, "conversationId");
        requireText(payload, "messageId");
        requirePlatform(payload);
        requireText(payload, "platformMessageId");
        requireText(payload, "timestamp");
        ObjectNode emission = mapper.createObjectNode()
                .put("messageId", payload.get("messageId").asText())
                .put("platformMessageId", payload.get("platformMessageId").asText())
                .put("timestamp", payload.get("timestamp").asText());
        publisher.publishToRoom(
                RealtimeRooms.conversation(payload.get("conversationId").asText()),
                WebSocketEnvelope.of(RealtimeEvents.MESSAGE_ACK, emission));
    }

    // --- frozen bare-payload validation (baseline required-member parity) ---

    private static void requireText(JsonNode payload, String member) {
        if (payload == null || !payload.hasNonNull(member)
                || payload.get(member).asText().isBlank()) {
            throw new IllegalArgumentException(member + " is required");
        }
    }

    private static void requirePlatform(JsonNode payload) {
        requireText(payload, "platform");
        if (!PLATFORMS.contains(payload.get("platform").asText())) {
            throw new IllegalArgumentException("Unknown connector platform: "
                    + payload.get("platform").asText());
        }
    }

    private void copyIfPresent(JsonNode payload, String member, ObjectNode target) {
        if (payload.hasNonNull(member)) {
            target.set(member, payload.get(member));
        }
    }
}
