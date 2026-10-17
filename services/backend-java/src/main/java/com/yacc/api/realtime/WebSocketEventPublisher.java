package com.yacc.api.realtime;

import java.io.IOException;
import java.util.Collection;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.api.realtime.WebSocketEnvelope;

/**
 * The single server→client emit path (MIG-050; ADR-026; ledger WS-BHV-001 —
 * MIG-003 §4.1 applies the {@code {event,data,timestamp}} envelope uniformly
 * to ALL emissions). Every envelope is serialized once here and delivered to
 * the live channels of a room, or to one session for connect-time/ack
 * emissions; feature emission sites never touch {@link WebSocketSession}
 * send APIs directly.
 *
 * <p>Send failures are swallowed by design: a dead channel is cleaned up by
 * the transport-error/close callbacks of the handler, and a failed emit must
 * never break the emitting business flow. {@code publishToSession} reports
 * the failure through its result so durability-critical callers — the
 * backlog replay — can retain undelivered rows; room/global fan-outs remain
 * fire-and-forget.</p>
 *
 * <p>MIG-051 (WS-BHV-009): room and global emits of backlog-eligible events
 * additionally store the event for every connected recipient via
 * {@link WebSocketBacklogService} — the baseline gateway's automatic
 * backlog side of {@code emitToConversation}/{@code emitGlobally} — and the
 * except-sender overloads support the baseline {@code socket.broadcast} /
 * {@code socket.to(room)} fan-out semantics (presence/typing).</p>
 */
@Component
public class WebSocketEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventPublisher.class);

    private final WebSocketSessionRegistry registry;

    private final WebSocketBacklogService backlog;

    private final ObjectMapper mapper;

    public WebSocketEventPublisher(WebSocketSessionRegistry registry,
            WebSocketBacklogService backlog, ObjectMapper mapper) {
        this.registry = registry;
        this.backlog = backlog;
        this.mapper = mapper;
    }

    /**
     * Emits one enveloped event to every live channel in the room and stores
     * it for every connected recipient (backlog-eligible events only).
     *
     * @param room     room name (frozen namespace)
     * @param envelope the enveloped event
     */
    public void publishToRoom(String room, WebSocketEnvelope envelope) {
        Collection<WebSocketSession> channels = registry.channelsInRoom(room);
        publish(channels, envelope);
        storeForRecipients(channels, room, envelope);
    }

    /**
     * Emits one enveloped event to every live channel in the room except the
     * given session (baseline {@code socket.to(room).emit} sender exclusion)
     * and stores it for every connected recipient (backlog-eligible events
     * only — the sender is stored too, as the baseline store loop did).
     *
     * @param room             room name (frozen namespace)
     * @param excludeSessionId transport session id to exclude (the sender)
     * @param envelope         the enveloped event
     */
    public void publishToRoom(String room, String excludeSessionId, WebSocketEnvelope envelope) {
        Collection<WebSocketSession> channels = registry.channelsInRoom(room).stream()
                .filter(channel -> !channel.getId().equals(excludeSessionId))
                .toList();
        publish(channels, envelope);
        storeForRecipients(registry.channelsInRoom(room), room, envelope);
    }

    /**
     * Emits one enveloped event to every connected session (baseline
     * {@code emitGlobally}, WS-BHV-002 — queue-event broadcasts) and stores
     * it for every connected user (backlog-eligible events only).
     *
     * @param envelope the enveloped event
     */
    public void publishToAll(WebSocketEnvelope envelope) {
        Collection<WebSocketSession> channels = registry.allChannels();
        publish(channels, envelope);
        storeForRecipients(channels, null, envelope);
    }

    /**
     * Emits one enveloped event to every connected session except the given
     * session (baseline {@code socket.broadcast.emit} sender exclusion) and
     * stores it for every connected user (backlog-eligible events only).
     *
     * @param excludeSessionId transport session id to exclude (the sender)
     * @param envelope         the enveloped event
     */
    public void publishToAll(String excludeSessionId, WebSocketEnvelope envelope) {
        Collection<WebSocketSession> channels = registry.allChannels().stream()
                .filter(channel -> !channel.getId().equals(excludeSessionId))
                .toList();
        publish(channels, envelope);
        storeForRecipients(registry.allChannels(), null, envelope);
    }

    /**
     * Emits one enveloped event to a single session (connect-time events,
     * subscription acks, replay). Never backlogged (baseline direct emits
     * were not stored).
     *
     * @param session  the target channel
     * @param envelope the enveloped event
     * @return whether the frame was written to the channel — the observable
     *         form of a send failure; the failure is still never propagated
     *         (durability-critical callers such as the backlog replay use it
     *         to retain undelivered rows instead of throwing through the
     *         emitting flow)
     */
    public boolean publishToSession(WebSocketSession session, WebSocketEnvelope envelope) {
        return publish(java.util.List.of(session), envelope);
    }

    private boolean publish(Collection<WebSocketSession> channels, WebSocketEnvelope envelope) {
        String wire = serialize(envelope);
        boolean allDelivered = true;
        for (WebSocketSession channel : channels) {
            try {
                synchronized (channel) {
                    channel.sendMessage(new TextMessage(wire));
                }
            } catch (IOException e) {
                // The close/transport-error callbacks unregister the dead
                // channel; never propagate into the emitting flow.
                allDelivered = false;
                log.debug("WS emit dropped for closed session {}: {}",
                        channel.getId(), e.getMessage());
            }
        }
        return allDelivered;
    }

    /**
     * Backlog store side of the room/global emit paths (WS-BHV-009). The
     * frozen backlog is one rolling window <em>per user</em> (the baseline
     * gateway enumerated unique connected user ids), so recipients are
     * deduplicated by user id before storing — multiple live sockets of one
     * user share the single durable copy that a replay restores.
     */
    private void storeForRecipients(Collection<WebSocketSession> channels, String room,
            WebSocketEnvelope envelope) {
        if (!backlog.isEligible(envelope.event())) {
            return;
        }
        channels.stream()
                .map(channel -> registry.identity(channel.getId()))
                .flatMap(java.util.Optional::stream)
                .map(RealtimeSession::userId)
                .distinct()
                .forEach(userId -> backlog.store(userId, room, envelope));
    }

    private String serialize(WebSocketEnvelope envelope) {
        try {
            return mapper.writeValueAsString(envelope);
        } catch (IOException e) {
            throw new IllegalStateException("WS envelope serialization failed", e);
        }
    }
}
