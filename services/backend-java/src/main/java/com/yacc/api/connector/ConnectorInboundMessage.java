package com.yacc.api.connector;

import java.util.UUID;

/**
 * The exchange-internal normalized inbound message (MIG-062 D2; the union of
 * the two normalized connector payloads {@link TelegramInboundMessage} /
 * {@link IrcInboundMessage} — POC {@code InboundMessageEvent} parity with
 * the additive nullable IRC profile component of guardrail G12).
 *
 * @param platform         {@code telegram} | {@code irc}
 * @param externalThreadId platform thread id (Telegram chat id / IRC channel)
 * @param ircProfileId     resolved IRC profile id, null for Telegram and for
 *                         the config-store IRC fallback (G12)
 * @param senderId         external sender id (never blank — normalized)
 * @param senderName       external sender display name (never blank)
 * @param body             message text
 * @param receivedAt       platform/receive timestamp (UTC basis)
 * @param correlationId    per-event tracing id
 */
record ConnectorInboundMessage(
        String platform,
        String externalThreadId,
        Integer ircProfileId,
        String senderId,
        String senderName,
        String body,
        java.time.LocalDateTime receivedAt,
        UUID correlationId) {
}
