package com.yacc.api.connector;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Normalized Telegram inbound message (POC {@code InboundMessageEvent}
 * parity) — the payload the intake seam hands to
 * {@link TelegramUpdateReceiver}.
 *
 * @param platform            always {@code telegram}
 * @param externalThreadId    platform thread id (Telegram chat id)
 * @param senderExternalUserId platform user id ({@code "unknown"} when the
 *                            update carries no sender, baseline parity)
 * @param senderDisplayName   username → first name → {@code "Unknown"}
 *                            (baseline precedence)
 * @param body                message text (text-only updates normalize;
 *                            the baseline drops non-text messages)
 * @param receivedAt          platform timestamp (Telegram epoch seconds,
 *                            normalized to UTC)
 * @param correlationId       per-event tracing id
 * @param rawUpdateJson       original Bot API update JSON (parity
 *                            {@code rawPayload})
 */
public record TelegramInboundMessage(
        String platform,
        String externalThreadId,
        String senderExternalUserId,
        String senderDisplayName,
        String body,
        LocalDateTime receivedAt,
        UUID correlationId,
        String rawUpdateJson) {
}
