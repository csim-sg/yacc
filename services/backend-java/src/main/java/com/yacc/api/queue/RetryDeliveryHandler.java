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
 * is the MIG-062 (#359) gateway exchange
 * ({@code com.yacc.api.connector.GatewayExchange}).</p>
 *
 * <p><b>Delivery guarantee — at-least-once, no exactly-once claim:</b> the
 * frozen contract has no consumer acknowledgement, so the worker cannot
 * promise exactly-once delivery and does not claim to. Duplicates arise
 * from a <em>started</em> attempt whose outcome was never recorded: the
 * invocation-start marker is the last durable write before the
 * {@code deliver} call, so recovery consumes that attempt conservatively
 * and re-delivers under the next attempt number. An unstarted claim (a
 * crash before the invocation began) is never consumed — it is released
 * and re-delivered under the SAME attempt number, so a delivery can never
 * be silently skipped on the last ladder step either. Implementers must
 * therefore tolerate repeated {@code deliver} calls for the same
 * {@code messageId} — collapsing duplicates by messageId at the delivery
 * target is the implementer's idempotence boundary. Loss is never traded
 * for a duplicate.</p>
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
     * The terminal-cycle notification (founder Option A, guardrails
     * G15/G16): called <b>once</b> by the worker
     * ({@link QueueRetryService}) after the durable terminal state has
     * committed — on both terminal paths, the delivery-path exhaustion and
     * the interrupted-claim settlement — so the terminal
     * {@code queue.message.dlq} signal can never publish an undurable
     * fact. Best-effort and at-most-once per terminal transition: the
     * committed {@code retryCycle.exhausted} marker short-circuits every
     * later worker entry point, so a firing/poll/settlement never notifies
     * twice (a manual re-queue clears the marker — a later exhaustion is a
     * <em>new</em> transition and notifies again). Exactly-once is not
     * claimed and no outbox exists: a notification can be lost only in the
     * crash window between the terminal commit and the in-memory fan-out —
     * the durable DLQ row, the {@code failed} message status and the
     * {@code failed} job state are the authoritative record.
     *
     * <p>Implementations must never throw (the notification must not break
     * the state machine, the scheduler thread or the job removal) and must
     * not run inside a DB transaction (durable first, then publish — the
     * notification happens after the terminal write commits). The
     * default is a documented no-op (G11 additive-seam pattern), so every
     * existing lambda/mock keeps compiling.</p>
     *
     * @param messageId the exhausted message identity
     */
    default void onCycleExhausted(UUID messageId) {
        // no-op default (G11): the production implementation is the
        // MIG-062 (#359) gateway exchange via GatewayRedeliveryHandler.
    }

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
