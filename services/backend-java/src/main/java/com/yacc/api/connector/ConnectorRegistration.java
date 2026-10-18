package com.yacc.api.connector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import jakarta.annotation.PreDestroy;

/**
 * Startup registration of the two merged connectors into the
 * {@link ConnectorRegistry} (MIG-062 D1; POC
 * {@code integrations-runtime.service.ts} parity) and the graceful
 * {@code disconnectAll} shutdown parity. Deliberately thin: no lifecycle
 * orchestration beyond registration — the connectors self-manage their
 * connections and the exchange resolves adapters through the registry.
 */
@Component
public class ConnectorRegistration {

    private static final Logger log = LoggerFactory.getLogger(ConnectorRegistration.class);

    private final ConnectorRegistry registry;

    public ConnectorRegistration(TelegramConnector telegram, IrcConnector irc,
            ConnectorRegistry registry) {
        this.registry = registry;
        registry.register(TelegramConnector.PLATFORM, telegram);
        registry.register(IrcConnector.PLATFORM, irc);
        log.info("Connector registration complete (platforms={})", registry.platforms());
    }

    /** Baseline {@code adapterRegistry.disconnectAll()} shutdown parity. */
    @PreDestroy
    void shutdown() {
        registry.disconnectAll();
    }
}
