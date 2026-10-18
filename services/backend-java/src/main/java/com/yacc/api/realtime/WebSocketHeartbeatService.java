package com.yacc.api.realtime;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * The application-level 60s heartbeat (MIG-051; ADR-026; ledger WS-BHV-010 —
 * at baseline a Socket.io engine-level ping, re-implemented as the frozen
 * {@code system.heartbeat} contract event now that the polling fallback and
 * the engine are gone).
 *
 * <p>Interval: {@code yacc.realtime.heartbeat-interval-ms} (default 60000 =
 * the frozen WS-BHV-010 value) — a plain property because the scheduling
 * annotation needs a String placeholder. Delivered through the single
 * publish path to every connected session; heartbeats are not backlog
 * events.</p>
 */
@Component
public class WebSocketHeartbeatService {

    /** Frozen heartbeat interval (WS-BHV-010 {@code PING_INTERVAL_MS}). */
    static final String DEFAULT_INTERVAL_MS = "60000";

    private final WebSocketEventPublisher publisher;

    private final ObjectMapper mapper;

    public WebSocketHeartbeatService(WebSocketEventPublisher publisher, ObjectMapper mapper) {
        this.publisher = publisher;
        this.mapper = mapper;
    }

    /** Broadcasts one {@code system.heartbeat} envelope to every session. */
    @Scheduled(fixedRateString = "${yacc.realtime.heartbeat-interval-ms:"
            + DEFAULT_INTERVAL_MS + "}")
    public void beat() {
        publisher.publishToAll(WebSocketEnvelope.of(RealtimeEvents.SYSTEM_HEARTBEAT,
                mapper.valueToTree(SystemEventPayload.of(SystemEventPayload.TYPE_HEARTBEAT))));
    }
}
