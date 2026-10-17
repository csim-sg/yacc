package com.yacc.api.realtime;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * The raw-WS presence behavior (MIG-051; ledger WS-EVT-009/012/013,
 * WS-OP-PRES-001..005, WS-BHV-014 — the baseline {@code presence.controller}
 * semantics preserved on raw WS). All outbound {@code presence.updated}
 * emissions carry the one canonical shape
 * ({@link PresenceUpdatedPayload}; canonicalization §4.5 — the baseline
 * disconnect {@code isOnline} variant is retired).
 *
 * <ul>
 *   <li>{@code presence.updated} (inbound): validated canonical payload
 *       broadcast to everyone except the sender;</li>
 *   <li>{@code user.online}: {@code presence.updated} online broadcast
 *       except the sender + the {@code online.users} reply to the requesting
 *       session (no outbound {@code user.online} emit exists);</li>
 *   <li>{@code user.offline}: {@code presence.updated} offline broadcast
 *       except the sender (the server disconnect path uses the same
 *       broadcast);</li>
 *   <li>{@code user.status}: granular {@code user.status.changed} broadcast
 *       except the sender;</li>
 *   <li>{@code request.online.users}: the {@code online.users} reply (or the
 *       canonical {@code system.error} frame on failure).</li>
 * </ul>
 *
 * <p>Online users are derived live from the session registry (distinct
 * connected identities) — no second presence state exists (ADR-026).</p>
 */
@Component
public class WebSocketPresenceService {

    private final WebSocketSessionRegistry registry;

    private final WebSocketEventPublisher publisher;

    private final ObjectMapper mapper;

    public WebSocketPresenceService(WebSocketSessionRegistry registry,
            WebSocketEventPublisher publisher, ObjectMapper mapper) {
        this.registry = registry;
        this.publisher = publisher;
        this.mapper = mapper;
    }

    /** Inbound {@code presence.updated} → canonical broadcast except sender. */
    public void onPresenceUpdated(WebSocketSession session, JsonNode data) {
        PresenceUpdatedPayload payload = canonicalPresence(data);
        if (payload == null) {
            emitBadFrame(session, "presence.updated requires userId, status and lastSeen");
            return;
        }
        publisher.publishToAll(session.getId(), envelope(
                RealtimeEvents.PRESENCE_UPDATED, payload));
    }

    /** Inbound {@code user.online} → online broadcast + online.users reply. */
    public void onUserOnline(WebSocketSession session, JsonNode data) {
        String userId = textMember(data, "userId");
        if (userId == null) {
            emitBadFrame(session, "user.online requires userId");
            return;
        }
        publisher.publishToAll(session.getId(), envelope(
                RealtimeEvents.PRESENCE_UPDATED,
                new PresenceUpdatedPayload(userId, PresenceUpdatedPayload.STATUS_ONLINE,
                        Instant.now())));
        replyOnlineUsers(session);
    }

    /** Inbound {@code user.offline} → offline broadcast except sender. */
    public void onUserOffline(WebSocketSession session, JsonNode data) {
        String userId = textMember(data, "userId");
        if (userId == null) {
            emitBadFrame(session, "user.offline requires userId");
            return;
        }
        publisher.publishToAll(session.getId(), envelope(
                RealtimeEvents.PRESENCE_UPDATED,
                new PresenceUpdatedPayload(userId, PresenceUpdatedPayload.STATUS_OFFLINE,
                        Instant.now())));
    }

    /** Inbound {@code user.status} → granular status broadcast except sender. */
    public void onUserStatus(WebSocketSession session, JsonNode data) {
        String userId = textMember(data, "userId");
        String status = textMember(data, "status");
        if (userId == null || status == null
                || !List.of(UserStatusChangedPayload.STATUS_ACTIVE,
                        UserStatusChangedPayload.STATUS_IDLE,
                        UserStatusChangedPayload.STATUS_AWAY).contains(status)) {
            emitBadFrame(session, "user.status requires userId and status active|idle|away");
            return;
        }
        publisher.publishToAll(session.getId(), envelope(
                RealtimeEvents.USER_STATUS_CHANGED,
                new UserStatusChangedPayload(userId, status, Instant.now())));
    }

    /** Inbound {@code request.online.users} → online.users reply. */
    public void onRequestOnlineUsers(WebSocketSession session) {
        try {
            replyOnlineUsers(session);
        } catch (RuntimeException e) {
            publisher.publishToSession(session, WebSocketEnvelope.of(
                    RealtimeEvents.SYSTEM_ERROR,
                    mapper.valueToTree(SystemEventPayload.error(
                            YaccWebSocketHandler.ERROR_CODE_TRANSPORT,
                            "Failed to fetch online users"))));
        }
    }

    /**
     * Server disconnect path → offline broadcast for the last socket of a
     * user (ledger WS-OP-CONV-002 presence half + WS-BHV-014
     * last-socket-off rule; canonical §4.5 shape). Call after the session
     * has been unregistered so remaining sockets of the same user suppress
     * the broadcast.
     */
    public void broadcastOfflineIfLastSocket(RealtimeSession identity) {
        boolean stillConnected = registry.allChannels().stream()
                .map(channel -> registry.identity(channel.getId()))
                .flatMap(java.util.Optional::stream)
                .anyMatch(session -> session.userId().equals(identity.userId()));
        if (stillConnected) {
            return;
        }
        publisher.publishToAll(envelope(RealtimeEvents.PRESENCE_UPDATED,
                new PresenceUpdatedPayload(identity.userId(),
                        PresenceUpdatedPayload.STATUS_OFFLINE, Instant.now())));
    }

    private void replyOnlineUsers(WebSocketSession session) {
        publisher.publishToSession(session, envelope(RealtimeEvents.ONLINE_USERS,
                new OnlineUsersPayload(onlineUserIds(), Instant.now())));
    }

    private List<String> onlineUserIds() {
        return registry.allChannels().stream()
                .map(channel -> registry.identity(channel.getId()))
                .flatMap(java.util.Optional::stream)
                .map(RealtimeSession::userId)
                .distinct()
                .toList();
    }

    /**
     * Validates an inbound {@code presence.updated} payload against the
     * canonical shape ({userId, status online|offline, lastSeen}) — the
     * frozen publish side references the same canonical schema.
     */
    private PresenceUpdatedPayload canonicalPresence(JsonNode data) {
        if (data == null || !data.hasNonNull("userId") || !data.hasNonNull("status")
                || !data.hasNonNull("lastSeen")) {
            return null;
        }
        String status = data.get("status").asText();
        if (!List.of(PresenceUpdatedPayload.STATUS_ONLINE,
                PresenceUpdatedPayload.STATUS_OFFLINE).contains(status)) {
            return null;
        }
        return new PresenceUpdatedPayload(data.get("userId").asText(), status,
                Instant.now());
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
