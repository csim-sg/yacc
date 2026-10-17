package com.yacc.api.connector;

/**
 * Typed receiver for normalized Telegram inbound messages — the injectable
 * target of the connector intake seam (AC-MIG-060-1 inbound parity; no HTTP
 * webhook route exists: the frozen OpenAPI has no Telegram path and GOV-038
 * locks the surface).
 *
 * <p>MIG-062 (#359) replaces the {@link TelegramConnectorConfig} no-op
 * default with the connector→realtime bridge (ledger WS-OP-CONN-001; the
 * WS ops and {@code connector:{platform}} rooms are MIG-062 scope). Until
 * then implementations must be cheap and must never throw into the
 * connector.</p>
 */
@FunctionalInterface
public interface TelegramUpdateReceiver {

    /**
     * Receives every normalized inbound message.
     *
     * @param message normalized Telegram inbound message
     */
    void onInboundMessage(TelegramInboundMessage message);
}
