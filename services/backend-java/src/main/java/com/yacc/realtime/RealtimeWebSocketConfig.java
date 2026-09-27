package com.yacc.realtime;

import java.util.Objects;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.yacc.realtime.service.YaccWebSocketHandler;
import com.yacc.realtime.service.WebSocketHandshakeAuthInterceptor;
import com.yacc.realtime.service.WebSocketSessionRegistry;

/**
 * Raw WebSocket wiring (MIG-050; ADR-026; guardrails 004 §4). Registers the
 * raw endpoint — handler + auth-on-handshake interceptor — and declares the
 * in-memory session registry singleton. Raw WebSocket only: no broker
 * subprotocols, no fallback transports (founder-fixed; AC-MIG-050-2).
 *
 * <p>Authorization is enforced fail-closed in the handshake interceptor (the
 * security filter chain cannot see the upgrade's {@code token} query
 * parameter), so the wire path is {@code permitAll} at the filter-chain level
 * and every upgrade is authenticated or denied with 401 before any session
 * exists.</p>
 *
 * <p>The handler and interceptor beans are resolved through
 * {@link ObjectProvider} at registration time (not config construction):
 * both depend on the registry {@code @Bean} declared here, so eager
 * constructor injection would create a bean-creation cycle.</p>
 */
@Configuration
@EnableWebSocket
public class RealtimeWebSocketConfig implements WebSocketConfigurer {

    private final RealtimeProperties properties;

    private final ObjectProvider<YaccWebSocketHandler> handler;

    private final ObjectProvider<WebSocketHandshakeAuthInterceptor> handshakeAuthInterceptor;

    public RealtimeWebSocketConfig(RealtimeProperties properties,
            ObjectProvider<YaccWebSocketHandler> handler,
            ObjectProvider<WebSocketHandshakeAuthInterceptor> handshakeAuthInterceptor) {
        this.properties = properties;
        this.handler = handler;
        this.handshakeAuthInterceptor = handshakeAuthInterceptor;
    }

    /** In-memory session registry — the (userId, conversationId) index. */
    @Bean
    public WebSocketSessionRegistry webSocketSessionRegistry() {
        return new WebSocketSessionRegistry();
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        RealtimeProperties.WebSocket binding = properties.websocket();
        registry.addHandler(Objects.requireNonNull(handler.getObject()), binding.path())
                .addInterceptors(Objects.requireNonNull(handshakeAuthInterceptor.getObject()))
                .setAllowedOrigins(binding.allowedOrigins().toArray(String[]::new));
    }
}
