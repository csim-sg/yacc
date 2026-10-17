package com.yacc.api.realtime;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The canonical {@code presence.updated} payload (MIG-051; frozen schema
 * {@code .docs/migration/schemas/presence-updated.schema.json},
 * canonicalization §4.5 — ALL outbound emissions use exactly this shape,
 * including the disconnect path; the baseline {@code {userId, isOnline,
 * timestamp}} variant is retired).
 *
 * <p>{@code lastSeen} serializes through the single production Jackson
 * posture (MIG-102) as RFC 3339 UTC — the same {@code ObjectMapper} the
 * publisher serializes every envelope with.</p>
 *
 * @param userId   presence subject
 * @param status   {@code online} or {@code offline} (frozen enum)
 * @param lastSeen ISO 8601 event time
 */
public record PresenceUpdatedPayload(
        @JsonProperty("userId") String userId,
        @JsonProperty("status") String status,
        @JsonProperty("lastSeen") Instant lastSeen) {

    public static final String STATUS_ONLINE = "online";
    public static final String STATUS_OFFLINE = "offline";
}
