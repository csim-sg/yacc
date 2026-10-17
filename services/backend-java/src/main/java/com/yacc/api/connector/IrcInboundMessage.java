package com.yacc.api.connector;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Normalized IRC inbound message (POC {@code InboundMessageEvent} /
 * {@code ingestInboundMessage} payload parity) — the payload the intake
 * seam hands to {@link IrcMessageReceiver}.
 *
 * @param platform             always {@code irc}
 * @param externalThreadId     IRC channel the message was sent to (PRIVMSG
 *                             target)
 * @param senderExternalUserId sender nick
 * @param senderDisplayName    sender nick (IRC carries no separate display
 *                             name)
 * @param body                 message text (PRIVMSG/NOTICE trailing)
 * @param receivedAt           server-observed receive time (IRC lines carry
 *                             no timestamp)
 * @param correlationId        per-event tracing id
 * @param rawLine              original protocol line (parity
 *                             {@code rawPayload})
 */
public record IrcInboundMessage(
        String platform,
        String externalThreadId,
        String senderExternalUserId,
        String senderDisplayName,
        String body,
        LocalDateTime receivedAt,
        UUID correlationId,
        String rawLine) {
}
