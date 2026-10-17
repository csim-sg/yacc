package com.yacc.api.realtime;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Real-time transport configuration binding (MIG-050; ADR-026; guardrails
 * 004 §4). Colocated in the {@code realtime} feature package; every value
 * has a KISS default so local development works with zero configuration.
 *
 * @param websocket raw WebSocket endpoint binding
 * @param reconnect server reconnect policy binding (MIG-051; ledger
 *                  WS-BHV-011 — the deterministic backoff computation the
 *                  reconnection behavior is expressed against; the client
 *                  ladder itself is MIG-052's, canonicalization §3)
 */
@ConfigurationProperties(prefix = "yacc.realtime")
public record RealtimeProperties(WebSocket websocket, Reconnect reconnect) {

    /**
     * Raw WebSocket endpoint policy.
     *
     * @param path           upgrade endpoint path (public at the servlet
     *                       filter chain; the handshake interceptor is the
     *                       auth gate). Env {@code YACC_REALTIME_WS_PATH}.
     * @param allowedOrigins browser origins allowed to upgrade (baseline
     *                       parity: the Socket.io CORS origin was the
     *                       frontend URL). Env
     *                       {@code YACC_REALTIME_WS_ALLOWED_ORIGINS}
     *                       (comma-separated).
     */
    public record WebSocket(String path, List<String> allowedOrigins) {

        /** KISS development defaults: same path the frontend targets first. */
        public static final String DEFAULT_PATH = "/ws";
        public static final List<String> DEFAULT_ALLOWED_ORIGINS =
                List.of("http://localhost:5173");

        public WebSocket {
            if (path == null || path.isBlank()) {
                path = DEFAULT_PATH;
            }
            if (allowedOrigins == null || allowedOrigins.isEmpty()) {
                allowedOrigins = DEFAULT_ALLOWED_ORIGINS;
            }
        }
    }

    /**
     * Server reconnect policy (MIG-051; ledger WS-BHV-011 — the frozen
     * {@code RECONNECT_CONFIG}: initial 1000ms, max 60000ms, maxAttempts 5,
     * factor 2). {@link #delayForAttempt(int)} is the deterministic,
     * unit-testable exponential-backoff computation; {@link #maxDelayMs}
     * doubles as the server-observed reconnect-detection window (a session
     * re-established for a user seen disconnected within this bound is a
     * reconnect). Env {@code YACC_REALTIME_RECONNECT_INITIAL_DELAY_MS} /
     * {@code ..._MAX_DELAY_MS} / {@code ..._MAX_ATTEMPTS} /
     * {@code ..._BACKOFF_FACTOR}.
     */
    public record Reconnect(Integer initialDelayMs, Integer maxDelayMs, Integer maxAttempts,
            Integer backoffFactor) {

        /** KISS defaults = the frozen WS-BHV-011 policy values. */
        public static final int DEFAULT_INITIAL_DELAY_MS = 1000;
        public static final int DEFAULT_MAX_DELAY_MS = 60000;
        public static final int DEFAULT_MAX_ATTEMPTS = 5;
        public static final int DEFAULT_BACKOFF_FACTOR = 2;

        public Reconnect {
            if (initialDelayMs == null || initialDelayMs <= 0) {
                initialDelayMs = DEFAULT_INITIAL_DELAY_MS;
            }
            if (maxDelayMs == null || maxDelayMs <= 0) {
                maxDelayMs = DEFAULT_MAX_DELAY_MS;
            }
            if (maxAttempts == null || maxAttempts <= 0) {
                maxAttempts = DEFAULT_MAX_ATTEMPTS;
            }
            if (backoffFactor == null || backoffFactor <= 1) {
                backoffFactor = DEFAULT_BACKOFF_FACTOR;
            }
        }

        /**
         * Deterministic exponential backoff: the delay in milliseconds before
         * the given 1-based attempt — {@code initialDelayMs × factor^(n-1)},
         * capped at {@code maxDelayMs}. With the frozen defaults:
         * 1000, 2000, 4000, 8000, 16000, then 60000 from attempt 6 on.
         */
        public long delayForAttempt(int attempt) {
            long delay = initialDelayMs;
            for (int i = 2; i <= attempt; i++) {
                delay = Math.min(delay * (long) backoffFactor, maxDelayMs);
            }
            return delay;
        }

        /**
         * Whether the policy gives up before the given 1-based attempt —
         * true once {@code maxAttempts} have been spent (the frozen
         * {@code system.reconnection.failed} trigger condition,
         * ledger WS-EVT-016).
         */
        public boolean exhausted(int attempt) {
            return attempt > maxAttempts;
        }
    }

    /**
     * Applies the KISS defaults when the section is absent from
     * configuration (mirrors {@code AuthProperties}).
     *
     * @param websocket raw WebSocket endpoint binding
     * @param reconnect server reconnect policy binding
     */
    public RealtimeProperties {
        if (websocket == null) {
            websocket = new WebSocket(null, null);
        }
        if (reconnect == null) {
            reconnect = new Reconnect(null, null, null, null);
        }
    }
}
