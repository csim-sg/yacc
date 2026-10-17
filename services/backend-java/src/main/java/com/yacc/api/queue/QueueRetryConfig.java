package com.yacc.api.queue;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Queue-module wiring (ARCH-004 §4 — module-local {@code @Configuration}
 * stays in the module). Provides the temporary no-op default for the seam
 * another migration task replaces:
 *
 * <ul>
 *   <li>{@link RetryDeliveryHandler} — MIG-062 (#359) replaces this default
 *       with the gateway-exchange redelivery (adapter dispatch + message
 *       status + breaker integration). The no-op reports NOT delivered —
 *       fail-closed: a no-op must never mark anything delivered.</li>
 * </ul>
 *
 * <p>The Quartz scheduler itself is Boot's auto-configured
 * {@code SchedulerFactoryBean} over the {@code spring.quartz.*} contract
 * (JDBC job store, Flyway V4 tables); no scheduler wiring lives here.</p>
 */
@Configuration
public class QueueRetryConfig {

    private static final Logger log = LoggerFactory.getLogger(QueueRetryConfig.class);

    /** No-op default until MIG-062 implements the redelivery exchange. */
    @Bean
    public RetryDeliveryHandler retryDeliveryHandler() {
        return messageId -> {
            log.debug("Redelivery attempted for {} (handler default; MIG-062 owns the exchange):"
                    + " not delivered", messageId);
            return RetryDeliveryHandler.RetryOutcome.failure(
                    "no redelivery handler registered (MIG-062)");
        };
    }
}
