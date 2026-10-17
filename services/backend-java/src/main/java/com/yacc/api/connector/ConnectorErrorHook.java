package com.yacc.api.connector;

/**
 * Adapter error seam (AC-MIG-060-2 hook — <b>not</b> the implementation).
 *
 * <p>Every adapter failure a connector surfaces is funneled through the
 * single typed {@link ConnectorAdapterError} path and handed to this hook.
 * The hook is the integration point MIG-063 (#360) implements:</p>
 *
 * <ul>
 *   <li><b>DLQ routing</b> — create the dead-letter entry through the
 *       existing DLQ persistence surface ({@code com.yacc.service.DlqService};
 *       it has no enqueue operation today, so entry-creation semantics are
 *       MIG-063 scope, ADR-028).</li>
 *   <li><b>Circuit breaker</b> — trip/open breaker state from the typed
 *       error stream (no breaker class exists today; MIG-063 scope).</li>
 * </ul>
 *
 * <p>MIG-063 implemented this seam as the component-scanned
 * {@code ConnectorBreakerErrorHook} (platform circuit breaker, threshold
 * 5); MIG-062's exchange added the message-correlated DLQ half on the
 * {@code DlqService#enqueue} surface.</p>
 */
@FunctionalInterface
public interface ConnectorErrorHook {

    /**
     * Receives every surfaced adapter error exactly once, in the order the
     * connector produced it.
     *
     * @param error the typed adapter error (never contains credentials)
     */
    void onAdapterError(ConnectorAdapterError error);
}
