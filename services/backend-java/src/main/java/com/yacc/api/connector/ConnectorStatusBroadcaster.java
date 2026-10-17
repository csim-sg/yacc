package com.yacc.api.connector;

import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.api.realtime.RealtimeEvents;
import com.yacc.api.realtime.RealtimeRooms;
import com.yacc.api.realtime.WebSocketEnvelope;
import com.yacc.api.realtime.WebSocketEventPublisher;

/**
 * The production {@link ConnectorStatusListener} (MIG-062; ledger
 * WS-RAW-008/009, WS-BHV-008 — the server-side connector-status emission)
 * and the breaker un-wedge path (guardrail G6). On every surfaced connector
 * status transition it:
 *
 * <ul>
 *   <li><b>resets the circuit breaker on {@code connected}</b> — baseline
 *       {@code adapter:connected} "reset failure counters" parity; this is
 *       the documented un-wedge path that prevents a permanently wedged
 *       breaker (the breaker never disconnects an adapter — MIG-063's
 *       documented deviation is preserved);</li>
 *   <li><b>emits the two frozen raw status channels</b> through the single
 *       enveloped emit path — {@code connector.status} broadcast (baseline
 *       {@code socket.broadcast.emit}) and {@code status.updated} to the
 *       {@code connector:{platform}} room (baseline
 *       {@code socket.broadcast.to(room).emit}, WS-BHV-008);</li>
 *   <li><b>fires the {@code adapter:connected}/{@code adapter:disconnected}/
 *       {@code adapter:error} lifecycle hooks</b> (G2 — fire-and-forget,
 *       no production subscriber).</li>
 * </ul>
 *
 * <p>Status vocabulary mapping (frozen AsyncAPI
 * {@code connector.status.changed} enum {@code connected|disconnected|error|
 * reconnecting}): {@link ConnectorStatus#CONNECTED} &rarr; {@code connected},
 * {@link ConnectorStatus#DISCONNECTED} &rarr; {@code disconnected},
 * {@link ConnectorStatus#ERROR} &rarr; {@code error} and
 * {@link ConnectorStatus#CONNECTING} &rarr; {@code reconnecting} — the
 * frozen vocabulary has no {@code connecting} member, and the only
 * {@code CONNECTING} transition a connector surfaces is the
 * reconnect-scheduled one (IRC reconnect cycle), so the mapping is
 * truthful for every surfaced transition. Never throws: a broadcast or
 * breaker failure is logged and cannot break the connector's own
 * lifecycle.</p>
 */
@Component
public class ConnectorStatusBroadcaster implements ConnectorStatusListener {

    private static final Logger log = LoggerFactory.getLogger(ConnectorStatusBroadcaster.class);

    private final WebSocketEventPublisher publisher;

    private final ConnectorCircuitBreaker breaker;

    private final GatewayHooks hooks;

    private final ObjectMapper mapper;

    public ConnectorStatusBroadcaster(WebSocketEventPublisher publisher,
            ConnectorCircuitBreaker breaker, GatewayHooks hooks, ObjectMapper mapper) {
        this.publisher = publisher;
        this.breaker = breaker;
        this.hooks = hooks;
        this.mapper = mapper;
    }

    @Override
    public void onStatusChange(String platform, ConnectorStatus status) {
        try {
            if (status == ConnectorStatus.CONNECTED) {
                // G6 un-wedge path: a connector reaching connected resets its
                // platform's failure counter and closes the breaker.
                breaker.recordSuccess(platform);
            }
            String wireStatus = wireStatus(status);
            Instant now = Instant.now();
            ObjectNode broadcast = mapper.createObjectNode()
                    .put("platform", platform)
                    .put("status", wireStatus)
                    .put("timestamp", now.toString());
            publisher.publishToAll(WebSocketEnvelope.of(RealtimeEvents.CONNECTOR_STATUS,
                    broadcast));
            ObjectNode room = mapper.createObjectNode()
                    .put("status", wireStatus)
                    .put("timestamp", now.toString());
            publisher.publishToRoom(RealtimeRooms.connector(platform),
                    WebSocketEnvelope.of(RealtimeEvents.STATUS_UPDATED, room));
            hookFor(status).ifPresent(hook -> hooks.fire(hook, platform));
        } catch (RuntimeException failure) {
            // Non-blocking: a status broadcast failure must never break the
            // connector's own lifecycle (listener seam contract).
            log.error("Connector status handling failed (non-blocking, platform={},"
                            + " status={}): {}", platform, status, failure.toString());
        }
    }

    /** The frozen wire vocabulary member for a connector status. */
    private static String wireStatus(ConnectorStatus status) {
        return switch (status) {
            case CONNECTED -> "connected";
            case DISCONNECTED -> "disconnected";
            case ERROR -> "error";
            case CONNECTING -> "reconnecting";
        };
    }

    /** The {@code adapter:*} lifecycle hook of a status transition (G2). */
    private static java.util.Optional<String> hookFor(ConnectorStatus status) {
        return switch (status) {
            case CONNECTED -> java.util.Optional.of(GatewayHooks.ADAPTER_CONNECTED);
            case DISCONNECTED -> java.util.Optional.of(GatewayHooks.ADAPTER_DISCONNECTED);
            case ERROR -> java.util.Optional.of(GatewayHooks.ADAPTER_ERROR);
            case CONNECTING -> java.util.Optional.<String>empty();
        };
    }
}
