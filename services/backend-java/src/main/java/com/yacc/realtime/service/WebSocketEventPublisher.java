package com.yacc.realtime.service;

import java.io.IOException;
import java.util.Collection;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.realtime.model.WebSocketEnvelope;

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
 * never break the emitting business flow.</p>
 */
@Component
public class WebSocketEventPublisher {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventPublisher.class);

    private final WebSocketSessionRegistry registry;

    private final ObjectMapper mapper;

    public WebSocketEventPublisher(WebSocketSessionRegistry registry, ObjectMapper mapper) {
        this.registry = registry;
        this.mapper = mapper;
    }

    /**
     * Emits one enveloped event to every live channel in the room.
     *
     * @param room     room name (frozen namespace)
     * @param envelope the enveloped event
     */
    public void publishToRoom(String room, WebSocketEnvelope envelope) {
        publish(registry.channelsInRoom(room), envelope);
    }

    /**
     * Emits one enveloped event to every connected session (baseline
     * {@code emitGlobally}, WS-BHV-002 — queue-event broadcasts).
     *
     * @param envelope the enveloped event
     */
    public void publishToAll(WebSocketEnvelope envelope) {
        publish(registry.allChannels(), envelope);
    }

    /**
     * Emits one enveloped event to a single session (connect-time events,
     * subscription acks).
     *
     * @param session  the target channel
     * @param envelope the enveloped event
     */
    public void publishToSession(WebSocketSession session, WebSocketEnvelope envelope) {
        publish(java.util.List.of(session), envelope);
    }

    private void publish(Collection<WebSocketSession> channels, WebSocketEnvelope envelope) {
        String wire = serialize(envelope);
        for (WebSocketSession channel : channels) {
            try {
                synchronized (channel) {
                    channel.sendMessage(new TextMessage(wire));
                }
            } catch (IOException e) {
                // The close/transport-error callbacks unregister the dead
                // channel; never propagate into the emitting flow.
                log.debug("WS emit dropped for closed session {}: {}",
                        channel.getId(), e.getMessage());
            }
        }
    }

    private String serialize(WebSocketEnvelope envelope) {
        try {
            return mapper.writeValueAsString(envelope);
        } catch (IOException e) {
            throw new IllegalStateException("WS envelope serialization failed", e);
        }
    }
}
