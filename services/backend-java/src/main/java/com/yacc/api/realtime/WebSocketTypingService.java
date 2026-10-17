package com.yacc.api.realtime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * The raw-WS typing behavior (MIG-051; ledger WS-EVT-010/011, WS-OP-TYPE-001..004,
 * WS-BHV-015 — the baseline {@code typing.controller} semantics preserved on
 * raw WS). Every fan-out targets the {@code conversation:{id}} room with the
 * sender excluded (baseline {@code socket.to(room).emit}).
 *
 * <ul>
 *   <li>{@code typing.started}: canonical payload fanned out except the
 *       sender;</li>
 *   <li>{@code typing.stopped}: canonical payload fanned out except the
 *       sender (explicit stop);</li>
 *   <li>{@code typing.timeout}: the timeout path — emits
 *       {@code typing.stopped} to the room (best-effort, never throws into
 *       the handler);</li>
 *   <li>{@code typing.heartbeat}: optional keep-alive, no reply (baseline
 *       no-op preserved).</li>
 * </ul>
 */
@Component
public class WebSocketTypingService {

    private static final Logger log = LoggerFactory.getLogger(WebSocketTypingService.class);

    private final WebSocketEventPublisher publisher;

    private final ObjectMapper mapper;

    public WebSocketTypingService(WebSocketEventPublisher publisher, ObjectMapper mapper) {
        this.publisher = publisher;
        this.mapper = mapper;
    }

    /** Inbound {@code typing.started} → room fan-out except sender. */
    public void onTypingStarted(WebSocketSession session, JsonNode data) {
        String conversationId = textMember(data, "conversationId");
        String userId = textMember(data, "userId");
        String name = textMember(data, "name");
        if (conversationId == null || userId == null || name == null) {
            emitBadFrame(session, "typing.started requires conversationId, userId and name");
            return;
        }
        publisher.publishToRoom(RealtimeRooms.conversation(conversationId), session.getId(),
                envelope(RealtimeEvents.TYPING_STARTED,
                        new TypingStartedPayload(conversationId, userId, name)));
    }

    /** Inbound {@code typing.stopped} → room fan-out except sender. */
    public void onTypingStopped(WebSocketSession session, JsonNode data) {
        String conversationId = textMember(data, "conversationId");
        String userId = textMember(data, "userId");
        if (conversationId == null || userId == null) {
            emitBadFrame(session, "typing.stopped requires conversationId and userId");
            return;
        }
        publisher.publishToRoom(RealtimeRooms.conversation(conversationId), session.getId(),
                envelope(RealtimeEvents.TYPING_STOPPED,
                        new TypingStoppedPayload(conversationId, userId)));
    }

    /**
     * Inbound {@code typing.timeout} → emits {@code typing.stopped} to the
     * room (best-effort — failures are logged, never propagated).
     */
    public void onTypingTimeout(WebSocketSession session, JsonNode data) {
        try {
            String conversationId = textMember(data, "conversationId");
            String userId = textMember(data, "userId");
            if (conversationId == null || userId == null) {
                emitBadFrame(session, "typing.timeout requires conversationId and userId");
                return;
            }
            publisher.publishToRoom(RealtimeRooms.conversation(conversationId), session.getId(),
                    envelope(RealtimeEvents.TYPING_STOPPED,
                            new TypingStoppedPayload(conversationId, userId)));
        } catch (RuntimeException e) {
            log.debug("typing.timeout handling dropped: {}", e.getMessage());
        }
    }

    /** Inbound {@code typing.heartbeat} — optional keep-alive, no reply. */
    public void onTypingHeartbeat(JsonNode data) {
        log.debug("Typing keep-alive for user {}, conversation {}",
                data == null ? null : textMember(data, "userId"),
                data == null ? null : textMember(data, "conversationId"));
    }

    private String textMember(JsonNode data, String member) {
        return data == null || !data.hasNonNull(member)
                || data.get(member).asText().isBlank()
                ? null
                : data.get(member).asText();
    }

    private WebSocketEnvelope envelope(String event, Object payload) {
        return WebSocketEnvelope.of(event, mapper.valueToTree(payload));
    }

    private void emitBadFrame(WebSocketSession session, String message) {
        publisher.publishToSession(session, WebSocketEnvelope.of(
                RealtimeEvents.SYSTEM_ERROR,
                mapper.valueToTree(SystemEventPayload.error(
                        YaccWebSocketHandler.ERROR_CODE_BAD_FRAME, message))));
    }
}
