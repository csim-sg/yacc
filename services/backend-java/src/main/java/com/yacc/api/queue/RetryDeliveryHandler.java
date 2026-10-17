package com.yacc.api.queue;

import java.util.UUID;

/**
 * Redelivery seam of the Quartz retry worker (MIG-063; ADR-028). One call =
 * one redelivery attempt for a DLQ-backed job.
 *
 * <p>Implementations own the delivery semantics — adapter dispatch, message
 * status transitions, connector circuit-breaker integration — exactly where
 * the POC {@code gateway-exchange.handleOutbound} owned them; the worker
 * ({@link QueueRetryService}) owns only the schedule/backoff/exhaustion and
 * the DLQ row lifecycle around each attempt. The production implementation
 * is the MIG-062 (#359) gateway exchange; until that lands
 * {@link QueueRetryConfig} wires a documented no-op default that reports
 * NOT delivered (fail-closed: a no-op must never mark anything delivered).</p>
 *
 * <p><b>Delivery guarantee — at-least-once:</b> the frozen contract has no
 * consumer acknowledgement, so the worker cannot promise exactly-once
 * delivery and does not claim to. A crash between a {@code deliver} call
 * and the worker's durable outcome write is resolved by re-delivering the
 * message under the next attempt number (the worker persists the durable
 * attempt claim before calling this seam), so implementers must tolerate
 * repeated calls for the same {@code messageId} — collapsing duplicates by
 * messageId at the delivery target is the implementer's idempotence
 * boundary. Loss is never traded for a duplicate.</p>
 */
@FunctionalInterface
public interface RetryDeliveryHandler {

    /**
     * Performs one redelivery attempt for a DLQ-backed message.
     *
     * @param messageId the failed message identity — the opaque jobId's 1:1
     *                  Quartz key (REST-QUEUE-006; contract-canonicalization
     *                  §5 Note 5)
     * @return the attempt outcome: delivered (the retry cycle completes and
     *         the DLQ row is cleared) or failed with the reason that is
     *         recorded on the DLQ row ({@code last_error})
     */
    RetryOutcome deliver(UUID messageId);

    /**
     * One redelivery attempt result.
     *
     * @param delivered {@code true} when the message was delivered
     * @param error     the failure reason (required when not delivered)
     */
    record RetryOutcome(boolean delivered, String error) {

        /** Successful attempt. */
        public static RetryOutcome success() {
            return new RetryOutcome(true, null);
        }

        /** Failed attempt with the reason recorded on the DLQ row. */
        public static RetryOutcome failure(String error) {
            return new RetryOutcome(false, error);
        }
    }
}
