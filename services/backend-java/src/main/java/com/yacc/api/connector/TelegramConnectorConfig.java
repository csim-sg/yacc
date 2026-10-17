package com.yacc.api.connector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Connector module wiring (ARCH-004 §4 — connector-local {@code @Configuration}
 * stays in the module). Provides the temporary no-op default for the one
 * seam another migration task still replaces:
 *
 * <ul>
 *   <li>{@link TelegramUpdateReceiver} — MIG-062 (#359) replaces this
 *       default with the connector&rarr;realtime bridge (ledger
 *       WS-OP-CONN-001/002; no WS behavior lives in this module).</li>
 * </ul>
 *
 * <p>The {@link ConnectorErrorHook} seam is no longer a no-op: MIG-063's
 * component-scanned {@link ConnectorBreakerErrorHook} (platform circuit
 * breaker, threshold 5) is the single platform-generically-wired
 * implementation this module and the IRC connector share — the typed error
 * carries the platform id. DLQ entry creation requires message correlation
 * (frozen {@code dead_letter_queue} FKs) and goes through
 * {@code com.yacc.service.DlqService#enqueue} from the delivery path that
 * owns the identity (MIG-062's exchange).</p>
 */
@Configuration
public class TelegramConnectorConfig {

    private static final Logger log = LoggerFactory.getLogger(TelegramConnectorConfig.class);

    /** No-op default until MIG-062 implements the connector→realtime bridge. */
    @Bean
    public TelegramUpdateReceiver telegramUpdateReceiver() {
        return message -> log.debug("Telegram inbound message received (receiver default; MIG-062 owns the bridge): {}",
                message);
    }
}
