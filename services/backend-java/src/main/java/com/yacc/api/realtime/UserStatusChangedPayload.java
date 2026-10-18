package com.yacc.api.realtime;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The {@code user.status.changed} broadcast payload (MIG-051; ledger
 * WS-RAW-007 — granular presence beyond online/offline, baseline
 * {@code presence.controller.ts} preserved on raw WS).
 *
 * @param userId    presence subject
 * @param status    {@code active}, {@code idle} or {@code away} (frozen enum)
 * @param timestamp ISO 8601 broadcast time
 */
public record UserStatusChangedPayload(
        @JsonProperty("userId") String userId,
        @JsonProperty("status") String status,
        @JsonProperty("timestamp") Instant timestamp) {

    public static final String STATUS_ACTIVE = "active";
    public static final String STATUS_IDLE = "idle";
    public static final String STATUS_AWAY = "away";
}
