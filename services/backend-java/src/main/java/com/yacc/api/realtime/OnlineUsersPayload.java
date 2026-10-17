package com.yacc.api.realtime;

import java.time.Instant;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The {@code online.users} reply payload (MIG-051; ledger WS-RAW-006 — the
 * online-users query reply of {@code user.online} /
 * {@code request.online.users}, preserved on raw WS).
 *
 * @param users     online user ids (distinct connected identities)
 * @param timestamp ISO 8601 reply time
 */
public record OnlineUsersPayload(
        @JsonProperty("users") List<String> users,
        @JsonProperty("timestamp") Instant timestamp) {
}
