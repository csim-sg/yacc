package com.yacc.realtime;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.yacc.realtime.service.WebSocketSessionRegistry;

/**
 * Declares the in-memory session-registry singleton (MIG-050; TR-03;
 * guardrails 004 §2/§4 — "WS registry beans" are {@code @Configuration} +
 * {@code @Bean} declared). Split from {@link RealtimeWebSocketConfig} so the
 * registry bean is not produced by the same {@code WebSocketConfigurer} bean
 * that constructor-injects the handler/interceptor consuming it: the
 * separation breaks the would-be bean-creation cycle and lets every
 * consumer resolve through plain constructor injection — no
 * {@code ObjectProvider} service-locator lookup.
 */
@Configuration
public class RealtimeSessionRegistryConfig {

    /** In-memory session registry — the (userId, conversationId) index. */
    @Bean
    public WebSocketSessionRegistry webSocketSessionRegistry() {
        return new WebSocketSessionRegistry();
    }
}
