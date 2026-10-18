package com.yacc.api.connector;

/**
 * The additive connector status-change seam (MIG-062; guardrails G6/G11) —
 * observes real connector lifecycle transitions for the server-side half of
 * the connector&rarr;realtime bridge and the breaker un-wedge path. Added
 * additively to both connectors with the established MIG-060/061 seam
 * pattern; connector internals are not restructured (escalation stop E4).
 *
 * <p>Implementations must never throw into the connector: a listener
 * failure must not break the connector's own lifecycle (the production
 * {@link ConnectorStatusBroadcaster} isolates its own failures).</p>
 */
@FunctionalInterface
public interface ConnectorStatusListener {

    /**
     * Receives every connector status transition the connector chooses to
     * surface (the meaningful lifecycle transitions — connected, error,
     * disconnected and the reconnect-scheduled transition — not the
     * internal fail-closed hygiene writes).
     *
     * @param platform the connector platform id (e.g. {@code telegram})
     * @param status   the transitioned-to status
     */
    void onStatusChange(String platform, ConnectorStatus status);
}
