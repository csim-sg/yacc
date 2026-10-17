package com.yacc.api.connector;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * IRC connector env-bound timing policy (ARCH-004 §4; MIG-061). Connection
 * coordinates and the server password are deliberately NOT properties —
 * they resolve DB-first through {@link IrcConnectionConfigResolver}
 * (AES-256-GCM at rest, ADR-027). The overrides exist for parity
 * tooling/tests; production uses the EA-spec defaults.
 *
 * @param connectTimeoutMs     TCP connect + registration deadline
 *                             (baseline {@code CONNECT_TIMEOUT_MS = 30000}).
 *                             Env {@code YACC_CONNECTOR_IRC_CONNECT_TIMEOUT_MS}.
 * @param reconnectBaseDelayMs exponential-backoff base (baseline 1000).
 *                             Env {@code YACC_CONNECTOR_IRC_RECONNECT_BASE_DELAY_MS}.
 * @param reconnectMaxDelayMs  backoff cap (baseline 60000). Env
 *                             {@code YACC_CONNECTOR_IRC_RECONNECT_MAX_DELAY_MS}.
 */
@ConfigurationProperties(prefix = "yacc.connector.irc")
public record IrcConnectorProperties(Integer connectTimeoutMs, Long reconnectBaseDelayMs,
        Long reconnectMaxDelayMs) {

    /** Baseline connect/registration deadline parity. */
    public static final int DEFAULT_CONNECT_TIMEOUT_MS = 30_000;

    /** Baseline backoff base parity (1s, 2s, 4s, 8s, 16s for attempts 1-5). */
    public static final long DEFAULT_RECONNECT_BASE_DELAY_MS = 1_000;

    /** Baseline backoff cap parity. */
    public static final long DEFAULT_RECONNECT_MAX_DELAY_MS = 60_000;

    public IrcConnectorProperties {
        if (connectTimeoutMs == null || connectTimeoutMs <= 0) {
            connectTimeoutMs = DEFAULT_CONNECT_TIMEOUT_MS;
        }
        if (reconnectBaseDelayMs == null || reconnectBaseDelayMs <= 0) {
            reconnectBaseDelayMs = DEFAULT_RECONNECT_BASE_DELAY_MS;
        }
        if (reconnectMaxDelayMs == null || reconnectMaxDelayMs < reconnectBaseDelayMs) {
            reconnectMaxDelayMs = DEFAULT_RECONNECT_MAX_DELAY_MS;
        }
    }

    /**
     * Baseline exponential backoff parity:
     * {@code delayMs = min(max, base * 2^(attempt-1))} — 1s, 2s, 4s, 8s,
     * 16s (capped) for the 1-based attempt numbers 1-5.
     *
     * @param attemptNumber 1-based attempt number
     * @param baseMs        backoff base delay
     * @param maxMs         backoff cap
     * @return delay in milliseconds before the given attempt
     */
    public static long backoffDelayMs(int attemptNumber, long baseMs, long maxMs) {
        if (attemptNumber <= 1) {
            return Math.min(maxMs, baseMs);
        }
        if (attemptNumber > 20) {
            return maxMs;
        }
        return Math.min(maxMs, baseMs << (attemptNumber - 1));
    }
}
