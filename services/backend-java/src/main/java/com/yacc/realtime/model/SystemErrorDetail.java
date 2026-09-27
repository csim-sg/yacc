package com.yacc.realtime.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Error detail of the frozen system-event payload
 * ({@code system-payload.schema.json}: required {@code code}/{@code message}).
 *
 * @param code    stable error code (implementation-level; no frozen literal set)
 * @param message human-readable error message
 */
public record SystemErrorDetail(
        @JsonProperty("code") String code,
        @JsonProperty("message") String message) {
}
