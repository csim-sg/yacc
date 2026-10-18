package com.yacc.api.connector;

/**
 * Typed receiver for normalized Telegram inbound messages — the injectable
 * target of the connector intake seam (AC-MIG-060-1 inbound parity; no HTTP
 * webhook route exists: the frozen OpenAPI has no Telegram path and GOV-038
 * locks the surface).
 *
 * <p>MIG-062 (#359) replaced the former no-op default with the production
 * {@link GatewayExchange} (ledger WS-OP-CONN-001; the WS ops and
 * {@code connector:{platform}} rooms are MIG-062 scope). Implementations
 * must be cheap and must never throw into the connector.</p>
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
