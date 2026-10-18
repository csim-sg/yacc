package com.yacc.api.realtime;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The {@code message.received} envelope {@code data} payload (MIG-062 D2;
 * frozen schema {@code .docs/migration/schemas/message-received.schema.json},
 * ledger WS-EVT-003 / WS-OP-CONN-001). All seven members are required by the
 * frozen schema; {@code attachments} is intentionally absent (no connector
 * attachment normalization exists). {@code timestamp} is the platform
 * receive time (baseline {@code event.receivedAt.toISOString()} parity),
 * serialized RFC 3339 UTC by the single Jackson posture (MIG-102).
 *
 * @param messageId      the persisted message id
 * @param conversationId the conversation id
 * @param platform       {@code telegram} | {@code irc}
 * @param senderId       platform sender identifier (never blank)
 * @param senderName     platform sender display name (never blank)
 * @param body           message text (never blank)
 * @param timestamp      platform receive time
 */
public record MessageReceivedPayload(
        @JsonProperty("messageId") UUID messageId,
        @JsonProperty("conversationId") UUID conversationId,
        @JsonProperty("platform") String platform,
        @JsonProperty("senderId") String senderId,
        @JsonProperty("senderName") String senderName,
        @JsonProperty("body") String body,
        @JsonProperty("timestamp") LocalDateTime timestamp) {
}
