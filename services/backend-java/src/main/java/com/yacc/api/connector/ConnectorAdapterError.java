package com.yacc.api.connector;

import java.time.LocalDateTime;

/**
 * Single typed connector adapter error (AC-MIG-060-2; POC
 * {@code SendError} + adapter error events parity). Every adapter failure a
 * connector surfaces flows through exactly one path: this record, handed to
 * the {@link ConnectorErrorHook} seam (DLQ routing + circuit breaker are
 * MIG-063 implementations of that seam).
 *
 * @param platform   platform identifier (e.g. {@code telegram})
 * @param operation  connector operation that failed ({@code connect},
 *                   {@code sendMessage}, ...)
 * @param code       typed error code
 * @param message    human-readable failure description (never contains
 *                   credentials)
 * @param retryable  baseline retryability semantics
 *                   ({@link ConnectorErrorCode#isRetryable()})
 * @param occurredAt server-observed failure time
 */
public record ConnectorAdapterError(
        String platform,
        String operation,
        ConnectorErrorCode code,
        String message,
        boolean retryable,
        LocalDateTime occurredAt) {
}
