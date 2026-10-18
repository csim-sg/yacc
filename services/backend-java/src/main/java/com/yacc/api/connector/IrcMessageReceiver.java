package com.yacc.api.connector;

/**
 * Typed receiver for normalized IRC inbound messages — the injectable
 * target of the connector intake seam (AC-MIG-061-1 inbound parity; mirror
 * of the MIG-060 {@link TelegramUpdateReceiver} pattern). MIG-062 (#359)
 * replaced the former no-op default with the production
 * {@link GatewayExchange} — the connector&rarr;conversation/WS bridge is
 * ledger WS-OP-CONN-001: conversation persistence, {@code message.received}
 * emission and the {@code connector:{platform}} rooms live there.
 * Implementations must be cheap and must never throw into the connector
 * (baseline ingestion-error parity — the connector logs and keeps the
 * protocol loop alive).
 */
@FunctionalInterface
public interface IrcMessageReceiver {

    /**
     * Receives every normalized inbound IRC message (PRIVMSG/NOTICE).
     *
     * @param message normalized IRC inbound message
     */
    void onInboundMessage(IrcInboundMessage message);
}
