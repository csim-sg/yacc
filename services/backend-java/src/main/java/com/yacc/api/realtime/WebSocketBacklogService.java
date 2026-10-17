package com.yacc.api.realtime;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.yacc.entity.WebSocketBacklogEntry;
import com.yacc.repository.WebSocketBacklogRepository;

/**
 * The PostgreSQL WebSocket event backlog (MIG-051; ADR-028; ledger
 * WS-BHV-009) — the durable re-home of the POC Redis
 * {@code ws:backlog:{userId}} store: a 1h rolling window per user that
 * survives restart (AC-MIG-051-1).
 *
 * <p>Lifecycle (WS-BHV-009): <em>store</em> on the room/global emit paths of
 * {@code WebSocketEventPublisher} for backlog-eligible events — exactly the
 * frozen {@code WebSocketEventMap} families the baseline gateway stored
 * (message, conversation, notification, queue) —, <em>replay</em> reads by
 * user ordered by emission filtering on {@code expires_at} (replay
 * correctness never depends on the sweep), and <em>clear</em> of the rows a
 * replay actually delivered — the full read set on a complete delivery, the
 * delivered prefix on an incomplete one, so the durable copy is never lost
 * to a failed delivery. Storage is best-effort by
 * design (baseline parity): a failed store must never break the emitting
 * flow.</p>
 *
 * <p>Expired-row deletion is storage hygiene, not correctness: a
 * Spring-native {@code @Scheduled} sweep (the V2 migration note assigns it
 * to MIG-051). Quartz is deliberately NOT used — ADR-028 assigns the Quartz
 * scheduler to MIG-063 (#360); this is not queue semantics.</p>
 */
@Component
public class WebSocketBacklogService {

    private static final Logger log = LoggerFactory.getLogger(WebSocketBacklogService.class);

    /** 1h rolling window (WS-BHV-009; POC {@code MESSAGE_BACKLOG_DURATION_MS}). */
    static final Duration BACKLOG_WINDOW = Duration.ofHours(1);

    /**
     * Sweep cadence (storage hygiene only — replay filters {@code expires_at}
     * itself; not a contract value).
     */
    static final long SWEEP_FIXED_DELAY_MS = 300_000;

    /**
     * Room prefix whose publishes carry a conversation scope (frozen
     * {@code conversation:{id}} namespace).
     */
    private static final String CONVERSATION_PREFIX = "conversation:";

    /**
     * Backlog-eligible event names — exactly the baseline
     * {@code WebSocketEventMap} families stored by the gateway emit paths
     * ({@code emitToConversation}/{@code emitGlobally}). Presence, typing and
     * {@code system.*} events were never stored by the baseline gateway and
     * are not eligible here either.
     */
    private static final Set<String> ELIGIBLE_EVENTS = Set.of(
            RealtimeEvents.MESSAGE_RECEIVED,
            RealtimeEvents.MESSAGE_SENT,
            RealtimeEvents.MESSAGE_FAILED,
            RealtimeEvents.CONVERSATION_UPDATED,
            RealtimeEvents.CONVERSATION_REOPENED,
            RealtimeEvents.NOTIFICATION_RECEIVED,
            RealtimeEvents.NOTIFICATION_READ,
            RealtimeEvents.NOTIFICATION_DISMISSED,
            RealtimeEvents.MESSAGE_RETRY_SCHEDULED,
            RealtimeEvents.QUEUE_MESSAGE_DLQ);

    private final WebSocketBacklogRepository repository;

    public WebSocketBacklogService(WebSocketBacklogRepository repository) {
        this.repository = repository;
    }

    /**
     * @param eventName frozen event name
     * @return whether the event family is stored for replay (the baseline
     *         {@code WebSocketEventMap} set)
     */
    public boolean isEligible(String eventName) {
        return isBaselineEligibleEvent(eventName);
    }

    /** Static form of {@link #isEligible} (shared with the unit tests). */
    static boolean isBaselineEligibleEvent(String eventName) {
        return ELIGIBLE_EVENTS.contains(eventName);
    }

    /**
     * Stores one emitted event for one user (best-effort, never throws —
     * baseline parity). Called by the publisher for every recipient of a
     * backlog-eligible room/global emission; no-op for ineligible events.
     *
     * @param userId         recipient user id
     * @param room           emitting room name ({@code null} for global
     *                       broadcasts; a {@code conversation:{id}} room
     *                       records the conversation scope)
     * @param envelope       the emitted envelope ({@code data} is stored as
     *                       the payload JSON)
     */
    public void store(String userId, String room, WebSocketEnvelope envelope) {
        if (!isEligible(envelope.event())) {
            return;
        }
        try {
            LocalDateTime emittedAt = LocalDateTime.now();
            repository.save(new WebSocketBacklogEntry(userId, envelope.event(),
                    conversationScopeOf(room), envelope.data().toString(), emittedAt,
                    emittedAt.plus(BACKLOG_WINDOW)));
        } catch (RuntimeException e) {
            log.debug("Backlog store dropped for user {}: {}", userId, e.getMessage());
        }
    }

    /**
     * Reads one user's unexpired backlog rows, oldest first (replay order;
     * the 1h window is enforced by the {@code expires_at} filter).
     */
    public List<WebSocketBacklogEntry> replayRows(String userId) {
        return repository.findByUserIdAndExpiresAtAfterOrderByEmittedAtAsc(userId,
                LocalDateTime.now());
    }

    /**
     * Clears exactly the given delivered rows of one user after a replay
     * (WS-BHV-009 clear step). The clear is scoped to the replay's read set —
     * the full set on a complete delivery, the already-delivered prefix on an
     * incomplete one — so undelivered rows survive for the next replay and
     * rows stored for the user while the replay ran are never dropped.
     *
     * @param userId        the replayed user
     * @param deliveredRows the replay rows that were written to the session
     */
    public void clear(String userId, Collection<WebSocketBacklogEntry> deliveredRows) {
        if (deliveredRows.isEmpty()) {
            return;
        }
        repository.deleteByUserIdAndIdIn(userId,
                deliveredRows.stream().map(WebSocketBacklogEntry::getId).toList());
    }

    /**
     * Scheduled expired-row sweep — storage hygiene only (the replay window
     * is the {@code expires_at} filter, never this method).
     */
    @Scheduled(fixedDelay = SWEEP_FIXED_DELAY_MS)
    public void purgeExpired() {
        long removed = repository.deleteByExpiresAtBefore(LocalDateTime.now());
        if (removed > 0) {
            log.debug("Backlog sweep removed {} expired rows", removed);
        }
    }

    private UUID conversationScopeOf(String room) {
        if (room == null || !room.startsWith(CONVERSATION_PREFIX)) {
            return null;
        }
        try {
            return UUID.fromString(room.substring(CONVERSATION_PREFIX.length()));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
