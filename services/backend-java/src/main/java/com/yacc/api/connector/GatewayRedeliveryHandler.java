package com.yacc.api.connector;

import java.util.UUID;

import org.springframework.stereotype.Component;

import com.yacc.api.queue.RetryDeliveryHandler;

/**
 * The production {@link RetryDeliveryHandler} bean (MIG-062 D4; guardrail
 * G11 — the replaced implementation of the MIG-063 redelivery seam): a thin
 * seam adapter delegating to the gateway exchange's
 * {@link GatewayExchange#deliver(UUID)}.
 *
 * <p>Deliberately a separate bean from the exchange itself: the exchange is
 * simultaneously the connectors' intake seam, and a
 * {@code @MockitoBean} override of the {@code RetryDeliveryHandler} type
 * (as the merged MIG-063 worker tests use) must replace exactly the
 * redelivery seam — not evict the exchange from the connectors' injection
 * points. The exchange's {@code QueueRetryService} dependency stays lazy
 * ({@code ObjectProvider}) for the same reason: the worker's delivery seam
 * leads back to this exchange while the exchange's failure path schedules
 * cycles on the worker (guardrail G7).</p>
 */
@Component
public class GatewayRedeliveryHandler implements RetryDeliveryHandler {

    private final GatewayExchange exchange;

    public GatewayRedeliveryHandler(GatewayExchange exchange) {
        this.exchange = exchange;
    }

    @Override
    public RetryOutcome deliver(UUID messageId) {
        return exchange.deliver(messageId);
    }
}
