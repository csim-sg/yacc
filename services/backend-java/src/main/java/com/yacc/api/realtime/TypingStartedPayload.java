package com.yacc.api.realtime;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The {@code typing.started} payload (MIG-051; frozen schema
 * {@code .docs/migration/schemas/typing-started.schema.json}) — fanned out to
 * the {@code conversation:{id}} room, sender excluded.
 *
 * @param conversationId conversation the typing happens in
 * @param userId         typing user
 * @param name           display name
 */
public record TypingStartedPayload(
        @JsonProperty("conversationId") String conversationId,
        @JsonProperty("userId") String userId,
        @JsonProperty("name") String name) {
}
