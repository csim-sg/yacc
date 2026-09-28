package com.yacc.realtime.model;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * The inbound (client → server) transport frame (MIG-050).
 *
 * <p>Raw WebSocket has no built-in event multiplexing; a single demux field
 * carries the frozen channel name. The envelope is outbound-only (MIG-003
 * §4.1 — inbound stays bare), so the inbound frame is exactly the envelope
 * shape minus {@code timestamp}: {@code {"event": <channel>, "data":
 * <payload>}}. {@code data} is the bare per-channel payload described by the
 * frozen AsyncAPI {@code publish} message schemas (e.g. a bare conversationId
 * string for {@code subscribe.conversation}).</p>
 *
 * <p>This record is the documented JSON boundary (guardrails 004 §3): frames
 * parse here, and every consumer reads typed values off {@code data}.</p>
 *
 * @param event frozen channel name
 * @param data  bare channel payload (per-channel AsyncAPI publish schema)
 */
public record WebSocketInboundFrame(String event, JsonNode data) {
}
