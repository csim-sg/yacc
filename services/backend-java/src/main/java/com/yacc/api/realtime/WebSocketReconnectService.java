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
 * then the post-replay clear (WS-BHV-009 store/replay/clear lifecycle; the
 * 1h window is the {@code expires_at} filter). When the restoration cannot
 * be completed, the frozen {@code system.reconnection.failed} event fires
 * together with {@code system.error} (WS-EVT-016) and the failure never
 * breaks the connect flow. Disconnects are recorded so a later session for
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

    private void restore(WebSocketSession session, String userId) {
        List<WebSocketBacklogEntry> rows = backlog.replayRows(userId);
        if (rows.isEmpty()) {
            return;
        }
        try {
            publisher.publishToSession(session, systemEnvelope(
                    RealtimeEvents.SYSTEM_BACKLOG_REPLAY_STARTED,
                    SystemEventPayload.TYPE_BACKLOG_REPLAY));
            for (WebSocketBacklogEntry row : rows) {
                publisher.publishToSession(session, new WebSocketEnvelope(
                        row.getEventName(), mapper.readTree(row.getPayload()), Instant.now()));
            }
            backlog.clear(userId);
            publisher.publishToSession(session, systemEnvelope(
                    RealtimeEvents.SYSTEM_BACKLOG_REPLAY_COMPLETED,
                    SystemEventPayload.TYPE_BACKLOG_REPLAY));
        } catch (Exception e) {
            log.warn("Backlog restoration failed for user {}: {}", userId, e.getMessage());
            publisher.publishToSession(session, systemEnvelope(
                    RealtimeEvents.SYSTEM_RECONNECTION_FAILED,
                    SystemEventPayload.TYPE_RECONNECTION));
            publisher.publishToSession(session, WebSocketEnvelope.of(
                    RealtimeEvents.SYSTEM_ERROR,
                    mapper.valueToTree(SystemEventPayload.error(
                            ERROR_CODE_BACKLOG_REPLAY, String.valueOf(e.getMessage())))));
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
