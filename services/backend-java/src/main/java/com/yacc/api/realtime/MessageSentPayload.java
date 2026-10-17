package com.yacc.api.realtime;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The {@code message.sent} envelope {@code data} payload (MIG-062 D3; frozen
 * schema {@code .docs/migration/schemas/message-sent.schema.json}, ledger
 * WS-EVT-004). All four members are required by the frozen schema;
 * {@code status} is the schema's {@code sent} constant. {@code sentAt} is
 * the delivery time (the connector send result's server clock), serialized
 * RFC 3339 UTC by the single Jackson posture (MIG-102).
 *
 * @param messageId      the persisted message id
 * @param conversationId the conversation id
 * @param status         the schema constant {@code sent}
 * @param sentAt         delivery time
 */
public record MessageSentPayload(
        @JsonProperty("messageId") UUID messageId,
        @JsonProperty("conversationId") UUID conversationId,
        @JsonProperty("status") String status,
        @JsonProperty("sentAt") LocalDateTime sentAt) {
}
