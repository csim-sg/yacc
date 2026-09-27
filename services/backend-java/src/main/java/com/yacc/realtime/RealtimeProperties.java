package com.yacc.realtime;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Real-time transport configuration binding (MIG-050; ADR-026; guardrails
 * 004 §4). Colocated in the {@code realtime} feature package; every value
 * has a KISS default so local development works with zero configuration.
 *
 * @param websocket raw WebSocket endpoint binding
 */
@ConfigurationProperties(prefix = "yacc.realtime")
public record RealtimeProperties(WebSocket websocket) {

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
     * Applies the KISS defaults when the section is absent from
     * configuration (mirrors {@code AuthProperties}).
     *
     * @param websocket raw WebSocket endpoint binding
     */
    public RealtimeProperties {
        if (websocket == null) {
            websocket = new WebSocket(null, null);
        }
    }
}
