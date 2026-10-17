package com.yacc.api.connector;

/**
 * The single gateway lifecycle-hook seam (MIG-062; guardrail G2 — the used
 * surface of the POC {@code gateway-hooks}, not a hook engine: no
 * priorities, no parallel execution, no plugin-defined hooks, no aggregated
 * results).
 *
 * <p><b>Parity-of-absence disposition</b> (same disposition pattern as
 * {@code contract-canonicalization.md} §4.4): the POC's production wiring
 * fires exactly the four {@code adapter:*} lifecycle hooks —
 * {@code adapter:registered}, {@code adapter:connected},
 * {@code adapter:disconnected}, {@code adapter:error} — and
 * <b>no subscriber consumes them</b> (fired by {@code AdapterRegistry},
 * fire-and-forget, errors logged). The {@code message:*} and
 * {@code conversation:*} hook families of {@code .docs/07-hooks.md} have
 * zero baseline wiring (no emitter, no consumer) and are deliberately
 * <b>not implemented</b> here; wiring any of them into real behavior would
 * be new behavior (escalation E1, not builder invention). Zero production
 * subscribers exist, so {@link GatewayHooks#fire} is observably identical
 * to the baseline: a logged, swallowed, no-op dispatch.</p>
 */
@FunctionalInterface
public interface GatewayHook {

    /**
     * Receives one fired lifecycle hook.
     *
     * @param hook     the hook name (the four {@code adapter:*} literals of
     *                 {@link GatewayHooks})
     * @param platform the platform the hook originated from
     */
    void onGatewayHook(String hook, String platform);
}
