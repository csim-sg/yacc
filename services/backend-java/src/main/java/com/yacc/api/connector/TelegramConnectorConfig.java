package com.yacc.api.connector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Connector module wiring (ARCH-004 §4 — connector-local {@code @Configuration}
 * stays in the module). Provides the temporary no-op defaults for the two
 * seams other migration tasks replace:
 *
 * <ul>
 *   <li>{@link ConnectorErrorHook} — MIG-063 (#360) replaces this default
 *       with DLQ enqueue (through the DLQ persistence surface) + circuit
 *       breaker (AC-MIG-060-2 hook; ADR-028).</li>
 *   <li>{@link TelegramUpdateReceiver} — MIG-062 (#359) replaces this
 *       default with the connector→realtime bridge (ledger
 *       WS-OP-CONN-001/002; no WS behavior lives in this module).</li>
 * </ul>
 *
 * <p>The default error hook logs at warn (the typed error carries no
 * credentials) so surfaced adapter failures stay observable until MIG-063.</p>
 */
@Configuration
public class TelegramConnectorConfig {

    private static final Logger log = LoggerFactory.getLogger(TelegramConnectorConfig.class);

    /** No-op default until MIG-063 implements DLQ routing + the breaker. */
    @Bean
    public ConnectorErrorHook connectorErrorHook() {
        return error -> log.warn("Connector adapter error surfaced (hook default; MIG-063 owns DLQ/breaker): {}",
                error);
    }

    /** No-op default until MIG-062 implements the connector→realtime bridge. */
    @Bean
    public TelegramUpdateReceiver telegramUpdateReceiver() {
        return message -> log.debug("Telegram inbound message received (receiver default; MIG-062 owns the bridge): {}",
                message);
    }
}
