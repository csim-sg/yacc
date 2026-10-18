package com.yacc.api.connector;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The fire-and-forget dispatcher of the four {@code adapter:*} lifecycle
 * hooks (MIG-062; guardrail G2 — see {@link GatewayHook} for the
 * parity-of-absence disposition of the unwired families). Baseline
 * semantics: a hook failure never propagates into the firing flow (the
 * connector's own result is never masked) and a missing subscriber is a
 * logged no-op. No hook engine: synchronous dispatch, no priorities, no
 * aggregation.
 */
@Component
public class GatewayHooks {

    /** {@code adapter:registered} — fired after a registry registration. */
    public static final String ADAPTER_REGISTERED = "adapter:registered";

    /** {@code adapter:connected} — fired on a connector status transition to connected. */
    public static final String ADAPTER_CONNECTED = "adapter:connected";

    /** {@code adapter:disconnected} — fired on a transition to disconnected. */
    public static final String ADAPTER_DISCONNECTED = "adapter:disconnected";

    /** {@code adapter:error} — fired on a connector error transition. */
    public static final String ADAPTER_ERROR = "adapter:error";

    private static final Logger log = LoggerFactory.getLogger(GatewayHooks.class);

    /** Zero production subscribers — the baseline parity-of-absence (G2). */
    private final List<GatewayHook> subscribers;

    public GatewayHooks(List<GatewayHook> subscribers) {
        this.subscribers = List.copyOf(subscribers);
    }

    /**
     * Fires one hook to every subscriber, isolating failures (never
     * throws — a hook failure must not mask the firing flow's own result).
     */
    public void fire(String hook, String platform) {
        for (GatewayHook subscriber : subscribers) {
            try {
                subscriber.onGatewayHook(hook, platform);
            } catch (RuntimeException failure) {
                log.warn("Gateway hook {} failed for platform {}: {}", hook, platform,
                        failure.toString());
            }
        }
    }
}
