package com.yacc.api.connector;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The MIG-063 {@link ConnectorErrorHook} implementation: every surfaced
 * adapter error feeds the platform circuit breaker (AC-MIG-060-2 seam
 * completion; ADR-028 threshold 5). Platform-generic by contract — the
 * typed error carries the platform id; no per-platform parallel error types
 * exist.
 *
 * <p><b>DLQ routing boundary (evidence-recorded interpretation):</b> the
 * typed seam is deliberately context-free (platform id only), and the
 * frozen {@code dead_letter_queue} schema requires real {@code message_id}
 * and {@code conversation_id} identities (FKs into {@code messages} /
 * {@code conversations}). The POC's context-free placeholder-id DLQ insert
 * (its {@code logToDLQ}) violated exactly that FK on every call and was
 * swallowed by its own catch block — a broken path the Java re-expression
 * does not replicate. DLQ entry creation therefore lives on the fail-closed
 * {@code com.yacc.service.DlqService#enqueue} surface for
 * message-correlated failures, called by the delivery path that owns the
 * identity (the MIG-062 #359 gateway exchange); this hook supplies the
 * breaker half and keeps the failure observable. The MIG-062 exchange also
 * consults {@link ConnectorCircuitBreaker#isOpen(String)} before dispatch
 * and records {@link ConnectorCircuitBreaker#recordSuccess(String)} on
 * delivered sends — the POC's reset-on-success point.</p>
 *
 * <p>Never throws (hook contract): a breaker failure is logged and
 * swallowed so a surfaced error cannot mask the connector's own
 * result/exception. Repeated errors are safe — one breaker count each.</p>
 */
@Component
public class ConnectorBreakerErrorHook implements ConnectorErrorHook {

    private static final Logger log = LoggerFactory.getLogger(ConnectorBreakerErrorHook.class);

    private final ConnectorCircuitBreaker breaker;

    public ConnectorBreakerErrorHook(ConnectorCircuitBreaker breaker) {
        this.breaker = breaker;
    }

    @Override
    public void onAdapterError(ConnectorAdapterError error) {
        try {
            boolean tripped = breaker.recordFailure(error.platform());
            if (tripped) {
                log.error("Connector adapter error tripped the {} circuit breaker:"
                                + " operation={} code={} retryable={} occurredAt={} message={}",
                        error.platform(), error.operation(), error.code(), error.retryable(),
                        error.occurredAt(), error.message());
            } else {
                log.warn("Connector adapter error surfaced (routed to the {} circuit breaker;"
                                + " DLQ entry creation needs message correlation — MIG-062):"
                                + " operation={} code={} retryable={} message={}",
                        error.platform(), error.operation(), error.code(), error.retryable(),
                        error.message());
            }
        } catch (RuntimeException failure) {
            log.error("Failed to route the connector adapter error to the circuit breaker"
                    + " (non-blocking): {}", failure.toString());
        }
    }
}
