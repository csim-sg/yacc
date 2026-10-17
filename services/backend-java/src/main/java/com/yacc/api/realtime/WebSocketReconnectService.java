package com.yacc.api.realtime;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.entity.WebSocketBacklogEntry;

/**
 * The server half of the reconnection behavior (MIG-051; ADR-026; ledger
 * WS-EVT-015/016, WS-BHV-011 — the client backoff ladder is MIG-052's,
 * canonicalization §3).
 *
 * <p>On session establishment for a user the server recently observed
 * disconnecting — within the reconnect policy window
 * ({@code RealtimeProperties.Reconnect#maxDelayMs}) — the session is a
 * <em>reconnect</em>: the frozen {@code system.reconnection.started} event
 * fires for it. The re-join of {@code user:{userId}} happens at connect in
 * the handler; every (re)establishment then restores missed traffic by
 * replaying the durable PostgreSQL backlog: {@code system.backlog.replay.started},
 * the stored envelopes in emission order, {@code system.backlog.replay.completed},
 * then the clear of the delivered rows (WS-BHV-009 store/replay/clear
 * lifecycle; the 1h window is the {@code expires_at} filter). When the
 * restoration cannot be completed — a repository read failure or a replay
 * frame the socket cannot take — the frozen {@code system.reconnection.failed}
 * event fires together with {@code system.error} (WS-EVT-016) and the failure
 * never breaks the connect flow; the undelivered rows are retained for the
 * next replay while the delivered prefix is not repeated. Disconnects are
 * recorded so a later session for
 * the same user is recognized as a reconnect; the tracker is in-memory on
 * purpose (ADR-026 single-instance registry) — a fresh process replays the
 * durable backlog without the {@code started} marker (restart replay,
 * AC-MIG-051-1).</p>
 */
@Component
public class WebSocketReconnectService {

    private static final Logger log = LoggerFactory.getLogger(WebSocketReconnectService.class);

    /** {@code system.error} code when backlog restoration fails. */
    static final String ERROR_CODE_BACKLOG_REPLAY = "backlog_replay_failed";

    private final WebSocketBacklogService backlog;

    private final WebSocketEventPublisher publisher;

    private final ObjectMapper mapper;

    private final RealtimeProperties properties;

    /** Last observed disconnect epoch-millis per user id (reconnect memory). */
    private final Map<String, Long> lastDisconnectedAtByUserId = new ConcurrentHashMap<>();

    public WebSocketReconnectService(WebSocketBacklogService backlog,
            WebSocketEventPublisher publisher, ObjectMapper mapper,
            RealtimeProperties properties) {
        this.backlog = backlog;
        this.publisher = publisher;
        this.mapper = mapper;
        this.properties = properties;
    }

    /**
     * Connection-establishment continuation: emits the reconnect marker for a
     * detected reconnect, then restores the user's durable backlog.
     */
    public void onSessionEstablished(WebSocketSession session, RealtimeSession identity) {
        if (isReconnect(identity.userId())) {
            publisher.publishToSession(session, systemEnvelope(
                    RealtimeEvents.SYSTEM_RECONNECTION_STARTED,
                    SystemEventPayload.TYPE_RECONNECTION));
        }
        restore(session, identity.userId());
    }

    /** Records the disconnect so a timely re-establishment is a reconnect. */
    public void onSessionClosed(RealtimeSession identity) {
        lastDisconnectedAtByUserId.put(identity.userId(), System.currentTimeMillis());
    }

    /**
     * Restores one user's durable backlog. The whole restoration — row read,
     * replay writes, clear — is failure-handled: a repository read failure
     * and an undeliverable replay frame both take the
     * {@code system.reconnection.failed} + {@code system.error} path instead
     * of escaping into the connect flow.
     *
     * <p>Delivery is tracked per frame: rows are cleared only as they are
     * delivered, so an incomplete replay retains the undelivered remainder
     * (the durable copy is never lost to a dead socket) while the already
     * delivered prefix is not re-delivered by a retry. The clear is scoped to
     * the replay's read set, so rows stored for the user while the replay ran
     * are never dropped.</p>
     */
    private void restore(WebSocketSession session, String userId) {
        List<WebSocketBacklogEntry> delivered = new java.util.ArrayList<>();
        try {
            List<WebSocketBacklogEntry> rows = backlog.replayRows(userId);
            if (rows.isEmpty()) {
                return;
            }
            deliverOrThrow(session, systemEnvelope(
                    RealtimeEvents.SYSTEM_BACKLOG_REPLAY_STARTED,
                    SystemEventPayload.TYPE_BACKLOG_REPLAY), "the replay start marker");
            for (WebSocketBacklogEntry row : rows) {
                deliverOrThrow(session, new WebSocketEnvelope(
                        row.getEventName(), mapper.readTree(row.getPayload()), Instant.now()),
                        "backlog row " + row.getId());
                delivered.add(row);
            }
            backlog.clear(userId, delivered);
            deliverOrThrow(session, systemEnvelope(
                    RealtimeEvents.SYSTEM_BACKLOG_REPLAY_COMPLETED,
                    SystemEventPayload.TYPE_BACKLOG_REPLAY),
                    "the replay completion marker");
        } catch (Exception e) {
            retainDeliveredOnly(userId, delivered);
            log.warn("Backlog restoration failed for user {}: {}", userId, e.getMessage());
            // Best-effort failure reporting; these writes are never required.
            publisher.publishToSession(session, systemEnvelope(
                    RealtimeEvents.SYSTEM_RECONNECTION_FAILED,
                    SystemEventPayload.TYPE_RECONNECTION));
            publisher.publishToSession(session, WebSocketEnvelope.of(
                    RealtimeEvents.SYSTEM_ERROR,
                    mapper.valueToTree(SystemEventPayload.error(
                            ERROR_CODE_BACKLOG_REPLAY, String.valueOf(e.getMessage())))));
        }
    }

    /** Publishes one replay frame; an unwritten frame fails the restoration. */
    private void deliverOrThrow(WebSocketSession session, WebSocketEnvelope envelope,
            String what) {
        if (!publisher.publishToSession(session, envelope)) {
            throw new IllegalStateException(what + " was not delivered");
        }
    }

    /**
     * Failure-path retention: drops exactly the rows the replay already
     * delivered. If this clear fails too, nothing is dropped — retention is
     * the safe default (the durable copy must survive an incomplete replay).
     */
    private void retainDeliveredOnly(String userId, List<WebSocketBacklogEntry> delivered) {
        if (delivered.isEmpty()) {
            return;
        }
        try {
            backlog.clear(userId, delivered);
        } catch (RuntimeException e) {
            log.debug("Delivered-prefix clear failed for user {}: {}", userId, e.getMessage());
        }
    }

    /**
     * Server-observed reconnect decision for the user: a recorded disconnect
     * within the policy window. Package-visible so the reconnect behavior
     * tests can wait for the close callback to record the disconnect before
     * re-establishing a session (no test polls on transport internals).
     */
    boolean isReconnect(String userId) {
        Long lastDisconnectedAt = lastDisconnectedAtByUserId.get(userId);
        return lastDisconnectedAt != null && System.currentTimeMillis() - lastDisconnectedAt
                <= properties.reconnect().maxDelayMs();
    }

    private WebSocketEnvelope systemEnvelope(String event, String systemType) {
        return WebSocketEnvelope.of(event,
                mapper.valueToTree(SystemEventPayload.of(systemType)));
    }
}
