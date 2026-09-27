package com.yacc.realtime;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.yacc.realtime.service.YaccWebSocketHandler;
import com.yacc.realtime.service.WebSocketHandshakeAuthInterceptor;

/**
 * Raw WebSocket wiring (MIG-050; ADR-026; guardrails 004 §2). Registers the
 * raw endpoint — handler + auth-on-handshake interceptor — through plain
 * constructor injection. Raw WebSocket only: no broker subprotocols, no
 * fallback transports (founder-fixed; AC-MIG-050-2).
 *
 * <p>Authorization is enforced fail-closed in the handshake interceptor (the
 * security filter chain cannot see the upgrade's {@code token} query
 * parameter), so the wire path is {@code permitAll} at the filter-chain level
 * and every upgrade is authenticated or denied with 401 before any session
 * exists.</p>
 *
 * <p>The registry bean is declared by {@link RealtimeSessionRegistryConfig};
 * that separation breaks the bean-creation cycle, so this config can
 * constructor-inject the handler and interceptor directly (no
 * {@code ObjectProvider} service-locator lookup).</p>
 */
@Configuration
@EnableWebSocket
public class RealtimeWebSocketConfig implements WebSocketConfigurer {

    private final RealtimeProperties properties;

    private final YaccWebSocketHandler handler;

    private final WebSocketHandshakeAuthInterceptor handshakeAuthInterceptor;

    public RealtimeWebSocketConfig(RealtimeProperties properties,
            YaccWebSocketHandler handler,
            WebSocketHandshakeAuthInterceptor handshakeAuthInterceptor) {
        this.properties = properties;
        this.handler = handler;
        this.handshakeAuthInterceptor = handshakeAuthInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        RealtimeProperties.WebSocket binding = properties.websocket();
        registry.addHandler(handler, binding.path())
                .addInterceptors(handshakeAuthInterceptor)
                .setAllowedOrigins(binding.allowedOrigins().toArray(String[]::new));
    }
}
