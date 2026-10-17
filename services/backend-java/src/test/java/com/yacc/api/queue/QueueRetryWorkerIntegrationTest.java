package com.yacc.api.queue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doCallRealMethod;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.UUID;
import java.util.function.BooleanSupplier;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
import com.yacc.entity.DeadLetterQueueEntry;
import com.yacc.service.DlqService;

/**
 * MIG-063 worker lifecycle over the real Testcontainers PostgreSQL data
 * layer (AC-MIG-063-1/2): retried-marker consumption, the 1:1 Quartz job
 * identity (REST-QUEUE-006), the schedule &rarr; fire &rarr; backoff
 * &rarr; DLQ-move cycle, exhaustion, success clearing, the frozen worker
 * concurrency, and — for the PR #420 review findings — the crash-safety
 * and self-healing behaviors: stranded durable jobs without triggers are
 * re-armed from the persisted cycle state, persistence/reschedule failures
 * are healed by the marker poll, interrupted attempt claims are consumed
 * and re-delivered (never silently assumed delivered), and orphaned jobs
 * are swept. The policy is overridden to fast, deterministic values — no
 * long sleeps; every wait is a bounded condition poll; faults are injected
 * with spies or by driving the worker seam directly (the frozen 1m/5m/30m
 * ladder itself is pinned by {@link QueueRetryPropertiesTest}).
 *
 * <p>Non-transactional by design: the Quartz firing threads must observe
 * committed DLQ rows. Committed writers clean up after themselves
 * ({@code @AfterEach}), the MIG-101 committed-row-writers rule.</p>
 */
@TestPropertySource(properties = {
        "spring.quartz.auto-startup=true",
        "yacc.queue.retry.backoff-delays-ms=50,100,200",
        "yacc.queue.retry.max-attempts=3",
        "yacc.queue.retry.marker-poll-interval-ms=3600000"
})
class QueueRetryWorkerIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID ACTOR = UUID.fromString(
            "00000000-0000-0000-0000-00000000d1a0");
    private static final Duration CYCLE_TIMEOUT = Duration.ofSeconds(15);

    @Autowired
    private Scheduler scheduler;
    @Autowired
    private QueueRetryService queueRetry;
    @MockitoSpyBean
    private DlqService dlq;
    @Autowired
    private com.yacc.repository.DeadLetterQueueEntryRepository dlqEntries;
    @Autowired
    private com.yacc.repository.ConversationRepository conversations;
    @Autowired
    private com.yacc.repository.MessageRepository messages;
    @MockitoBean
    private RetryDeliveryHandler handler;
    @MockitoSpyBean
    private Scheduler schedulerSpy;

    @AfterEach
    void cleanCommittedState() throws SchedulerException {
        // Committed-row writers self-clean (MIG-101 residual rule): the
        // Quartz job store and the seeded rows are removed after every test
        // so the shared container stays pristine. Conversation deletion
        // cascades messages and their DLQ rows (frozen FKs).
        scheduler.clear();
        dlqEntries.deleteAll();
        messages.deleteAll();
        conversations.deleteAll();
    }

    @Test
    void retriedMarkerConsumptionSchedulesAQuartzCycleWithTheOneToOneIdentity()
            throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        seedRetriedMarker(messageId);

        queueRetry.consumeRetriedMarkers();

        JobKey key = QueueRetryService.jobKey(messageId);
        assertThat(scheduler.checkExists(key)).isTrue();
        // REST-QUEUE-006 (canonicalization §5 Note 5): the key NAME is the
        // opaque jobId — 1:1 with the message identity, group = the
        // message-retry queue vocabulary.
        assertThat(key.getName()).isEqualTo(messageId.toString());
        assertThat(key.getGroup()).isEqualTo(QueueRetryService.JOB_GROUP);

        var triggers = scheduler.getTriggersOfJob(key);
        assertThat(triggers).hasSize(1);
        Date now = new Date();
        assertThat(triggers.getFirst().getNextFireTime()).isBetween(now,
                Date.from(now.toInstant().plusSeconds(5)));
        assertThat(queueRetry.jobState(messageId)).isEqualTo("retrying");
    }

    @Test
    void markerConsumptionIsIdempotentUnderRepeatedPolls() throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        seedRetriedMarker(messageId);

        queueRetry.consumeRetriedMarkers();
        queueRetry.consumeRetriedMarkers();
        queueRetry.consumeRetriedMarkers();

        assertThat(scheduler.getTriggersOfJob(QueueRetryService.jobKey(messageId))).hasSize(1);
    }

    @Test
    void failedAttemptsWalkTheBackoffLadderThenRecordTheExhaustedTerminalState()
            throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        seedRetriedMarker(messageId);
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));

        queueRetry.consumeRetriedMarkers();

        // The cycle runs to exhaustion on its own (fast policy): three
        // single-fire attempts walk the configured ladder, then the job is
        // removed and the DLQ row records the terminal state.
        await(CYCLE_TIMEOUT, () -> cycleExhausted(messageId) && jobGone(messageId));

        DeadLetterQueueEntry entry = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.isRetryCycleExhausted(entry)).isTrue();
        assertThat(dlq.retryCycleAttempt(entry)).isEqualTo(3);
        assertThat(entry.getTotalAttempts()).isEqualTo(4); // 1 seed + 3 redelivery attempts
        assertThat(entry.getLastError()).isEqualTo("smtp still down");
        assertThat(entry.getUpdatedAt()).isAfter(entry.getCreatedAt());

        assertThat(scheduler.checkExists(QueueRetryService.jobKey(messageId))).isFalse();
        // REST-QUEUE-006 state vocabulary: exhausted cycle maps to "failed"
        assertThat(queueRetry.jobState(messageId)).isEqualTo("failed");

        // A exhausted entry is never rescheduled — further polls are no-ops.
        queueRetry.consumeRetriedMarkers();
        assertThat(scheduler.checkExists(QueueRetryService.jobKey(messageId))).isFalse();
    }

    @Test
    void successfulRedeliveryClearsTheDlqRowAndCompletesTheCycle()
            throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        seedRetriedMarker(messageId);
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.success());

        queueRetry.consumeRetriedMarkers();

        await(CYCLE_TIMEOUT, () -> dlq.findByMessageId(messageId).isEmpty()
                && jobGone(messageId));

        // The cleared row is the delivered state (REST-QUEUE-006 vocabulary).
        assertThat(queueRetry.jobState(messageId)).isEqualTo("completed");
    }

    @Test
    void workerThreadPoolIsTheFrozenConcurrencyFive() throws SchedulerException {
        // POC messageRetryWorker.ts WORKER_CONCURRENCY = 5 parity — the
        // Quartz worker-thread pool bound, not a tunable.
        assertThat(scheduler.getMetaData().getThreadPoolSize()).isEqualTo(5);
    }

    @Test
    void strandedJobWithoutTriggerIsReArmedFromThePersistedCycleState()
            throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        seedRetriedMarker(messageId);
        queueRetry.scheduleCycle(messageId);
        // Fault: the one-shot trigger is gone while the durable job remains
        // (a persistence/reschedule failure between the fire and the next
        // schedule) — exactly the stranded state of the review finding.
        scheduler.unscheduleJob(scheduler.getTriggersOfJob(
                QueueRetryService.jobKey(messageId)).getFirst().getKey());
        assertThat(scheduler.checkExists(QueueRetryService.jobKey(messageId))).isTrue();
        assertThat(scheduler.getTriggersOfJob(QueueRetryService.jobKey(messageId))).isEmpty();
        assertThat(queueRetry.jobState(messageId)).isEqualTo("retrying");

        // Self-healing: the marker poll rebuilds the trigger from the
        // persisted cycle state instead of skipping the existing job.
        queueRetry.consumeRetriedMarkers();

        assertThat(scheduler.getTriggersOfJob(QueueRetryService.jobKey(messageId)))
                .hasSize(1);

        // The re-armed cycle actually runs: three failed attempts walk the
        // frozen ladder to the terminal state.
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));
        await(CYCLE_TIMEOUT, () -> cycleExhausted(messageId) && jobGone(messageId));
        DeadLetterQueueEntry entry = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.isRetryCycleExhausted(entry)).isTrue();
        assertThat(dlq.retryCycleAttempt(entry)).isEqualTo(3);
    }

    @Test
    void rescheduleFailureLeavesTheCycleStrandedAndTheMarkerPollHealsIt()
            throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        seedRetriedMarker(messageId);
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));
        // Fault: the in-execution reschedule of the next attempt fails once
        // (Quartz store unavailable) — the fired one-shot trigger is gone,
        // so the cycle is stranded with a recorded attempt.
        doThrow(new SchedulerException("injected reschedule failure"))
                .doCallRealMethod()
                .when(schedulerSpy).scheduleJob(any(org.quartz.Trigger.class));
        queueRetry.scheduleCycle(messageId);

        await(CYCLE_TIMEOUT, () -> outcomeRecorded(messageId, 1) && stranded(messageId));
        assertThat(scheduler.getTriggersOfJob(QueueRetryService.jobKey(messageId))).isEmpty();

        // Self-healing: the next poll re-arms the cycle and it runs to the
        // terminal state — the stranded cycle never resumes by itself.
        queueRetry.consumeRetriedMarkers();
        assertThat(scheduler.getTriggersOfJob(QueueRetryService.jobKey(messageId)))
                .hasSize(1);
        await(CYCLE_TIMEOUT, () -> cycleExhausted(messageId) && jobGone(messageId));
        DeadLetterQueueEntry entry = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.isRetryCycleExhausted(entry)).isTrue();
        assertThat(dlq.retryCycleAttempt(entry)).isEqualTo(3);
        assertThat(entry.getTotalAttempts()).isEqualTo(4); // 1 seed + 3 redeliveries
        verify(handler, times(3)).deliver(messageId);
    }

    @Test
    void anOrphanedJobWithoutADlqRowIsSweptByTheMarkerPoll() throws SchedulerException {
        // A job whose DLQ row no longer exists (the row was cleared while
        // the job removal failed) is invisible to the marker loop — the
        // poll's durable-job sweep removes it.
        UUID messageId = UUID.randomUUID();
        queueRetry.scheduleCycle(messageId);
        scheduler.unscheduleJob(scheduler.getTriggersOfJob(
                QueueRetryService.jobKey(messageId)).getFirst().getKey());
        assertThat(scheduler.checkExists(QueueRetryService.jobKey(messageId))).isTrue();

        queueRetry.consumeRetriedMarkers();

        assertThat(scheduler.checkExists(QueueRetryService.jobKey(messageId))).isFalse();
    }

    @Test
    void persistenceFailureAfterAFailedAttemptIsHealedWithTheAttemptCounted() {
        UUID messageId = UUID.randomUUID();
        seedRetriedMarker(messageId);
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));
        // Fault: the outcome write after the failed attempt dies once — the
        // execution dies between the durable claim and the outcome record,
        // the one-shot trigger is gone, and the claim is left in flight.
        doThrow(new RuntimeException("injected persistence failure"))
                .doCallRealMethod()
                .when(dlq).recordFailedAttempt(any(UUID.class), anyString(), anyInt(),
                        anyBoolean());
        queueRetry.scheduleCycle(messageId);

        await(CYCLE_TIMEOUT, () -> claimInFlight(messageId, 1) && stranded(messageId));
        assertThat(dlq.findByMessageId(messageId)
                .map(entry -> dlq.isAttemptOutcomeRecorded(entry)).orElse(true)).isFalse();

        // Self-healing: the poll settles the interrupted attempt (counted),
        // re-arms the cycle, and the ladder completes to the terminal state.
        queueRetry.consumeRetriedMarkers();
        await(CYCLE_TIMEOUT, () -> cycleExhausted(messageId) && jobGone(messageId));
        DeadLetterQueueEntry entry = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.retryCycleAttempt(entry)).isEqualTo(3);
        assertThat(entry.getTotalAttempts()).isEqualTo(4); // 1 seed + 3 (incl. interrupted)
        assertThat(entry.getLastError()).isEqualTo("smtp still down");
        verify(handler, times(3)).deliver(messageId);
    }

    @Test
    void interruptedClaimFromACrashedExecutionIsCountedAndRedelivered() {
        UUID messageId = UUID.randomUUID();
        var entry = seedRetriedMarker(messageId);
        // Crash simulation: attempt 1 was durably claimed, its delivery
        // never happened, and the execution died before any outcome.
        dlq.claimAttempt(entry.getId(), 1);
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));

        // Recovered firing: the interrupted claim is consumed (counted,
        // honestly recorded), and the message is re-delivered under the
        // next attempt number — attempt 1 itself is not re-delivered.
        queueRetry.executeRetryAttempt(messageId.toString());

        DeadLetterQueueEntry reloaded = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.retryCycleAttempt(reloaded)).isEqualTo(2);
        assertThat(dlq.isAttemptOutcomeRecorded(reloaded)).isTrue();
        assertThat(reloaded.getTotalAttempts()).isEqualTo(3); // seed + interrupted + attempt 2
        assertThat(reloaded.getLastError()).isEqualTo("smtp still down");
        verify(handler, times(1)).deliver(messageId);

        // The next firing walks the ladder to the terminal state.
        queueRetry.executeRetryAttempt(messageId.toString());
        reloaded = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.isRetryCycleExhausted(reloaded)).isTrue();
        assertThat(dlq.retryCycleAttempt(reloaded)).isEqualTo(3);
        assertThat(reloaded.getTotalAttempts()).isEqualTo(4);
        verify(handler, times(2)).deliver(messageId);
    }

    @Test
    void interruptedClaimAtTheLadderLimitExhaustsWithoutAnotherDelivery() {
        UUID messageId = UUID.randomUUID();
        var entry = seedRetriedMarker(messageId);
        // Crash simulation on the LAST allowed attempt: the claim is in
        // flight with an unknown outcome when the recovery happens.
        dlq.claimAttempt(entry.getId(), 3);

        queueRetry.executeRetryAttempt(messageId.toString());

        DeadLetterQueueEntry reloaded = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.isRetryCycleExhausted(reloaded)).isTrue();
        assertThat(dlq.retryCycleAttempt(reloaded)).isEqualTo(3);
        assertThat(reloaded.getTotalAttempts()).isEqualTo(2); // seed + the interrupted attempt
        verify(handler, never()).deliver(any());
        assertThat(queueRetry.jobState(messageId)).isEqualTo("failed");
    }

    @Test
    void aDeliveryLostToACrashWindowIsRedeliveredNotAssumedDelivered() {
        UUID messageId = UUID.randomUUID();
        var entry = seedRetriedMarker(messageId);
        // Crash simulation: attempt 1 claimed, the delivery MAY have
        // happened, the outcome write never did — unknowable without a
        // consumer ACK.
        dlq.claimAttempt(entry.getId(), 1);
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.success());

        // Loss-prevention: the message is re-delivered (the documented
        // at-least-once duplicate window), never silently assumed delivered.
        queueRetry.executeRetryAttempt(messageId.toString());

        verify(handler, times(1)).deliver(messageId);
        assertThat(dlq.findByMessageId(messageId)).isEmpty();
        assertThat(queueRetry.jobState(messageId)).isEqualTo("completed");
    }

    private DeadLetterQueueEntry seedRetriedMarker(UUID messageId) {
        var conversation = conversations.save(new com.yacc.entity.Conversation(UUID.randomUUID(),
                com.yacc.entity.ChannelType.IRC, "#retry"));
        var message = messages.save(new com.yacc.entity.Message(messageId, conversation.getId(),
                null, "yacc", "body", com.yacc.entity.MessageDirection.OUTBOUND));
        message.setStatus(com.yacc.entity.MessageStatus.FAILED);
        messages.save(message);
        DeadLetterQueueEntry entry = dlq.enqueue(messageId, conversation.getId(),
                "{\"origin\":\"mig-063-test\"}", "platform_error", 1, "initial failure",
                null, null);
        return dlq.markRetried(entry.getId(), ACTOR);
    }

    private boolean cycleExhausted(UUID messageId) {
        return dlq.findByMessageId(messageId)
                .map(entry -> dlq.isRetryCycleExhausted(entry))
                .orElse(false);
    }

    private boolean outcomeRecorded(UUID messageId, int attempt) {
        return dlq.findByMessageId(messageId)
                .map(entry -> dlq.retryCycleAttempt(entry) >= attempt)
                .orElse(false);
    }

    private boolean claimInFlight(UUID messageId, int attempt) {
        return dlq.findByMessageId(messageId)
                .map(entry -> dlq.retryCycleAttempt(entry) >= attempt
                        && !dlq.isAttemptOutcomeRecorded(entry))
                .orElse(false);
    }

    private boolean stranded(UUID messageId) {
        try {
            JobKey key = QueueRetryService.jobKey(messageId);
            return scheduler.checkExists(key) && scheduler.getTriggersOfJob(key).isEmpty();
        } catch (SchedulerException failure) {
            return false;
        }
    }

    private boolean jobGone(UUID messageId) {
        try {
            return !scheduler.checkExists(QueueRetryService.jobKey(messageId));
        } catch (SchedulerException failure) {
            return false;
        }
    }

    private static void await(Duration timeout, BooleanSupplier condition) {
        long deadline = System.nanoTime() + timeout.toNanos();
        while (System.nanoTime() < deadline) {
            if (condition.getAsBoolean()) {
                return;
            }
            try {
                Thread.sleep(10);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("await interrupted", interrupted);
            }
        }
        fail("condition not met within " + timeout);
    }
}
