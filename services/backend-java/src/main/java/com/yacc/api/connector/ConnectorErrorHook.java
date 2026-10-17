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
 * <p>Until MIG-063 lands, {@link TelegramConnectorConfig} wires a no-op
 * default. Implementations must never throw: an error surfaced here must
 * not mask the connector's own result/exception (fail-closed behavior of
 * the connector is defined independently of the hook outcome).</p>
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
