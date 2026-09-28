package com.yacc.realtime.service;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.web.socket.WebSocketSession;

import com.yacc.realtime.model.RealtimeSession;

/**
 * In-memory raw-WebSocket session registry (MIG-050; ADR-026; TR-04).
 *
 * <p>Keys every connected session by its transport id and indexes membership
 * in the frozen room namespaces — {@code user:{userId}},
 * {@code conversation:{conversationId}}, {@code connector:{platform}} — the
 * (userId, conversationId) keying ADR-026 fixes: a session is registered once
 * per user and indexed into exactly the rooms it joined. The
 * {@code user:{userId}} room doubles as the per-user index (baseline parity:
 * personal room joined at connect, WS-BHV-006).</p>
 *
 * <p>Deliberately in-memory and single-instance (ADR-029 deployment
 * envelope): the registry is a singleton infrastructure bean declared by the
 * realtime {@code @Configuration} (TR-03) and holds nothing durable — no
 * backlog, no presence state (MIG-051 owns those). All operations are
 * thread-safe; unregistering is idempotent so transport-error and close
 * callbacks cannot double-clean.</p>
 */
public class WebSocketSessionRegistry {

    private final Map<String, RealtimeSession> identitiesById = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> channelsById = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> roomsBySessionId = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> memberIdsByRoom = new ConcurrentHashMap<>();

    /**
     * Registers an authenticated session.
     *
     * @param identity authenticated identity attached at handshake
     * @param channel  the raw WebSocket session (send channel)
     */
    public void register(RealtimeSession identity, WebSocketSession channel) {
        identitiesById.put(identity.sessionId(), identity);
        channelsById.put(identity.sessionId(), channel);
        roomsBySessionId.put(identity.sessionId(), ConcurrentHashMap.newKeySet());
    }

    /**
     * Removes a session and its membership from every room. Idempotent.
     *
     * @param sessionId transport session id
     */
    public void unregister(String sessionId) {
        Set<String> rooms = roomsBySessionId.remove(sessionId);
        if (rooms != null) {
            rooms.forEach(room -> removeMembership(room, sessionId));
        }
        channelsById.remove(sessionId);
        identitiesById.remove(sessionId);
    }

    /**
     * Joins a room; the join is a no-op if the session is already a member.
     *
     * @param sessionId transport session id
     * @param room      room name (frozen namespace)
     */
    public void joinRoom(String sessionId, String room) {
        Set<String> rooms = roomsBySessionId.get(sessionId);
        if (rooms == null) {
            return; // Unknown (already unregistered) session — nothing to join.
        }
        rooms.add(room);
        memberIdsByRoom.computeIfAbsent(room, key -> ConcurrentHashMap.newKeySet())
                .add(sessionId);
    }

    /**
     * Leaves a room; leaving a room the session never joined is a no-op.
     *
     * @param sessionId transport session id
     * @param room      room name (frozen namespace)
     */
    public void leaveRoom(String sessionId, String room) {
        Set<String> rooms = roomsBySessionId.get(sessionId);
        if (rooms != null) {
            rooms.remove(room);
        }
        removeMembership(room, sessionId);
    }

    /**
     * @param sessionId transport session id
     * @return the authenticated identity, or empty when unregistered
     */
    public Optional<RealtimeSession> identity(String sessionId) {
        return Optional.ofNullable(identitiesById.get(sessionId));
    }

    /**
     * @param sessionId transport session id
     * @return the send channel, or empty when unregistered
     */
    public Optional<WebSocketSession> channel(String sessionId) {
        return Optional.ofNullable(channelsById.get(sessionId));
    }

    /**
     * @param room room name (frozen namespace)
     * @return the live send channels of every current member
     */
    public Collection<WebSocketSession> channelsInRoom(String room) {
        Set<String> members = memberIdsByRoom.get(room);
        if (members == null) {
            return Collections.emptyList();
        }
        return members.stream()
                .map(channelsById::get)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toUnmodifiableList());
    }

    /**
     * @return the live send channels of every connected session
     */
    public Collection<WebSocketSession> allChannels() {
        return Collections.unmodifiableCollection(channelsById.values());
    }

    private void removeMembership(String room, String sessionId) {
        Set<String> members = memberIdsByRoom.get(room);
        if (members != null) {
            members.remove(sessionId);
            if (members.isEmpty()) {
                memberIdsByRoom.remove(room, members);
            }
        }
    }
}
