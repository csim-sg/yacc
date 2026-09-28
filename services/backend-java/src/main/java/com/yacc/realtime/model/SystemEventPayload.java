package com.yacc.realtime.model;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The system-event payload (MIG-050; frozen schema
 * {@code .docs/migration/schemas/system-payload.schema.json}).
 *
 * <p>The envelope {@code data} member for the system event family:
 * {@code {type, timestamp, error?}} where {@code error} is present only when
 * {@code type} is {@code error} (MIG-003 §4.3 — the retired raw {@code error}
 * literal maps to {@code system.error} with exactly this shape).</p>
 *
 * @param type      one of heartbeat, connection_established, reconnection,
 *                  error, backlog_replay (frozen enum)
 * @param timestamp ISO 8601 event time
 * @param error     code/message detail; serialized only for {@code error}
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record SystemEventPayload(
        @JsonProperty("type") String type,
        @JsonProperty("timestamp") Instant timestamp,
        @JsonProperty("error") SystemErrorDetail error) {

    /** Frozen {@code type} member values (system-payload.schema.json). */
    public static final String TYPE_CONNECTION_ESTABLISHED = "connection_established";
    public static final String TYPE_ERROR = "error";

    /** System event without error detail (heartbeat/established/…). */
    public static SystemEventPayload of(String type) {
        return new SystemEventPayload(type, Instant.now(), null);
    }

    /** {@code system.error} payload (WS-BHV-017/WS-EVT-018 canonical shape). */
    public static SystemEventPayload error(String code, String message) {
        return new SystemEventPayload(TYPE_ERROR, Instant.now(),
                new SystemErrorDetail(code, message));
    }
}
