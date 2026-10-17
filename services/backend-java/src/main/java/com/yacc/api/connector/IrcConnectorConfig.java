package com.yacc.api.connector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * IRC connector wiring (ARCH-004 §4 — connector-local {@code @Configuration}
 * stays in the module). Provides the temporary no-op default for the seam
 * another migration task replaces:
 *
 * <ul>
 *   <li>{@link IrcMessageReceiver} — MIG-062 (#359) replaces this default
 *       with the connector→realtime bridge (ledger WS-OP-CONN-001/002; no
 *       WS behavior lives in this module).</li>
 * </ul>
 *
 * <p>The {@link ConnectorErrorHook} seam is implemented platform-generically
 * by MIG-063's {@link ConnectorBreakerErrorHook} (circuit breaker, threshold
 * 5), component-scanned once for both connectors — the typed error carries
 * the platform id. DLQ entry creation needs message correlation (frozen
 * {@code dead_letter_queue} FKs) and lands with MIG-062's exchange over
 * {@code DlqService#enqueue}.</p>
 */
@Configuration
public class IrcConnectorConfig {

    private static final Logger log = LoggerFactory.getLogger(IrcConnectorConfig.class);

    /** No-op default until MIG-062 implements the connector→realtime bridge. */
    @Bean
    public IrcMessageReceiver ircMessageReceiver() {
        return message -> log.debug(
                "IRC inbound message received (receiver default; MIG-062 owns the bridge): {}",
                message);
    }
}
