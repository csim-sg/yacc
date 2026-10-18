package com.yacc.api.connector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The thin platform&rarr;connector lookup (MIG-062; guardrail G1 — the
 * production slice of the POC {@code AdapterRegistry}: {@code register},
 * {@code get}, {@code getPlatforms}, {@code disconnectAll}). No plugin
 * loader, no config-schema machinery, no key index, no reflection (POC
 * parity — the binding ledger has zero registry-internal rows).
 *
 * <p>Registration is the baseline {@code adapter:registered} lifecycle-hook
 * fire point (G2 — fire-and-forget, never throws; no production subscriber,
 * parity-of-absence).</p>
 */
@Component
public class ConnectorRegistry {

    private static final Logger log = LoggerFactory.getLogger(ConnectorRegistry.class);

    private final GatewayHooks hooks;

    private final java.util.Map<String, PlatformConnector> connectors =
            new java.util.concurrent.ConcurrentHashMap<>();

    public ConnectorRegistry(GatewayHooks hooks) {
        this.hooks = hooks;
    }

    /**
     * Registers a connector under its platform id (baseline
     * overwrite-with-warning parity) and fires the
     * {@code adapter:registered} hook.
     */
    public void register(String platform, PlatformConnector connector) {
        if (connectors.put(platform, connector) != null) {
            log.warn("Overwriting existing adapter registration for {}", platform);
        }
        log.info("Registered connector: {}", platform);
        hooks.fire(GatewayHooks.ADAPTER_REGISTERED, platform);
    }

    /** The connector for a platform; empty when unregistered/unknown. */
    public java.util.Optional<PlatformConnector> get(String platform) {
        return java.util.Optional.ofNullable(connectors.get(platform));
    }

    /** True when a connector is registered for the platform. */
    public boolean isRegistered(String platform) {
        return connectors.containsKey(platform);
    }

    /** The registered platform ids (baseline {@code getPlatforms} parity). */
    public java.util.Set<String> platforms() {
        return java.util.Set.copyOf(connectors.keySet());
    }

    /**
     * Graceful shutdown of every registered connector (baseline
     * {@code disconnectAll} parity): errors are logged and never prevent
     * the other connectors from disconnecting.
     */
    public void disconnectAll() {
        log.info("Disconnecting all connectors...");
        connectors.forEach((platform, connector) -> {
            try {
                connector.disconnect();
            } catch (RuntimeException failure) {
                log.error("Failed to disconnect connector {}: {}", platform,
                        failure.toString());
            }
        });
        log.info("All connectors disconnected");
    }
}
