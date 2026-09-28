package com.yacc.realtime.model;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * The one outbound wire frame (MIG-050; ADR-026; WS-BHV-001).
 *
 * <p>{@code {event, data, timestamp}} is preserved verbatim from the
 * baseline gateway emit paths and — frozen by MIG-003 §4.1 — applied
 * uniformly to ALL server→client emissions (single emit path via
 * {@code WebSocketEventPublisher}). Client→server messages are bare payloads;
 * the envelope is outbound-only. {@code timestamp} is ISO 8601 set at emit
 * time (Instant serialization parity with the baseline
 * {@code new Date().toISOString()}).</p>
 *
 * <p>{@code data} is the event-specific payload as a {@link JsonNode} — the
 * documented JSON boundary (guardrails 004 §3); per-event payload schemas
 * live in the frozen AsyncAPI document.</p>
 *
 * @param event     event name (dot notation), one of the frozen
 *                  {@link RealtimeEvents} literals
 * @param data      event payload (per-event AsyncAPI schema)
 * @param timestamp ISO 8601 emit time
 */
public record WebSocketEnvelope(
        @JsonProperty("event") String event,
        @JsonProperty("data") JsonNode data,
        @JsonProperty("timestamp") Instant timestamp) {

    public static WebSocketEnvelope of(String event, JsonNode data) {
        return new WebSocketEnvelope(event, data, Instant.now());
    }
}
