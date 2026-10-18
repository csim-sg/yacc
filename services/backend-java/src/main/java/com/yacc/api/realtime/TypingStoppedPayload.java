package com.yacc.api.realtime;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The {@code typing.stopped} payload (MIG-051; frozen schema
 * {@code .docs/migration/schemas/typing-stopped.schema.json}) — emitted for
 * the explicit stop and the {@code typing.timeout} path (same fields per the
 * frozen schema note).
 *
 * @param conversationId conversation the typing happened in
 * @param userId         typing user
 */
public record TypingStoppedPayload(
        @JsonProperty("conversationId") String conversationId,
        @JsonProperty("userId") String userId) {
}
