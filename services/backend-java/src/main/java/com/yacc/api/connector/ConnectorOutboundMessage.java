package com.yacc.api.connector;

/**
 * Outbound send request handed to a connector (POC
 * {@code SendMessageRequest}/{@code OutboundMessagePayload} shared-shape
 * parity — the recipient semantics are platform-owned).
 *
 * @param conversationId YACC conversation UUID (audit correlation)
 * @param recipientId    platform recipient (Telegram: {@code telegram:chatId}
 *                       or a bare numeric chat id)
 * @param body           message text
 * @param correlationId  end-to-end tracing id (optional)
 */
public record ConnectorOutboundMessage(
        String conversationId,
        String recipientId,
        String body,
        String correlationId) {
}
