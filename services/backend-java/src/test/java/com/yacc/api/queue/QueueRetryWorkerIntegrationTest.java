package com.yacc.api.queue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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
 * concurrency, and — for the PR #420 review findings — the claim/invocation
 * crash-safety protocol (I1 no-loss / I2 termination / I3 honest
 * accounting): stranded durable jobs without triggers are re-armed from
 * the persisted cycle state, persistence/reschedule/invocation-start
 * failures are healed by the marker poll, an unstarted claim is RELEASED
 * (never consumed — the same attempt number is re-armed and delivered, so
 * a crash before a delivery cannot drop the message), a started
 * invocation without an outcome is CONSUMED (counted once, terminal at
 * the limit), a manual re-queue of a terminal entry restores a fresh
 * 3-attempt budget while the P0 once-only flag stays frozen, and orphaned
 * jobs are swept. The MIG-062 terminal notification (founder Option A,
 * G15/G16) is covered on both terminal paths: the delivery-path exhaustion
 * and the interrupted-claim settlement notify the
 * {@code RetryDeliveryHandler.onCycleExhausted} seam exactly once per
 * transition, non-terminal failures never notify, repeated firings/polls
 * never duplicate the notification, a failing notification never breaks
 * the cycle, and a manual re-queue makes a later exhaustion a NEW
 * transition. The policy is overridden to fast, deterministic values —
 * no long sleeps; every wait is a bounded condition poll; faults are
 * injected with spies or by driving the worker seam directly (the frozen
 * 1m/5m/30m ladder itself is pinned by {@link QueueRetryPropertiesTest}).
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
    @Autowired
    private QueueService queueService;
    @Autowired
    private com.yacc.api.message.MessageService messageService;

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
        // G15: the terminal row carries the documented terminal vocabulary,
        // written in the same transaction as the terminal marker.
        assertThat(entry.getFailureReason()).isEqualTo("max_retries_exceeded");
        assertThat(entry.getUpdatedAt()).isAfter(entry.getCreatedAt());

        assertThat(scheduler.checkExists(QueueRetryService.jobKey(messageId))).isFalse();
        // REST-QUEUE-006 state vocabulary: exhausted cycle maps to "failed"
        assertThat(queueRetry.jobState(messageId)).isEqualTo("failed");

        // The terminal notification fired exactly once — after the durable
        // terminal commit (G15/G16), on the delivery-path exhaustion.
        verify(handler, times(3)).deliver(messageId);
        verify(handler, times(1)).onCycleExhausted(messageId);

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
        // execution dies between the invocation start (claim + started,
        // written before the delivery) and the outcome record; the one-shot
        // trigger is gone and the started-without-outcome invocation is
        // left in flight.
        doThrow(new RuntimeException("injected persistence failure"))
                .doCallRealMethod()
                .when(dlq).recordFailedAttempt(any(UUID.class), anyString(), anyInt(),
                        anyBoolean());
        queueRetry.scheduleCycle(messageId);

        await(CYCLE_TIMEOUT, () -> claimInFlight(messageId, 1) && stranded(messageId));
        assertThat(dlq.findByMessageId(messageId)
                .map(entry -> dlq.isAttemptOutcomeRecorded(entry)).orElse(true)).isFalse();

        // Self-healing: the poll consumes the started invocation (counted —
        // its delivery happened but the outcome is unknowable), re-arms the
        // cycle, and the ladder completes to the terminal state.
        queueRetry.consumeRetriedMarkers();
        await(CYCLE_TIMEOUT, () -> cycleExhausted(messageId) && jobGone(messageId));
        DeadLetterQueueEntry entry = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.retryCycleAttempt(entry)).isEqualTo(3);
        assertThat(entry.getTotalAttempts()).isEqualTo(4); // 1 seed + 3 (incl. interrupted)
        assertThat(entry.getLastError()).isEqualTo("smtp still down");
        verify(handler, times(3)).deliver(messageId);
    }

    @Test
    void interruptedStartedInvocationBelowTheLimitIsConsumedAndRedelivered() {
        UUID messageId = UUID.randomUUID();
        var entry = seedRetriedMarker(messageId);
        // Crash simulation: attempt 1 was claimed AND its invocation
        // durably started; the outcome was never recorded (unknowable
        // without a consumer ACK).
        dlq.claimAttempt(entry.getId(), 1);
        dlq.markInvocationStarted(entry.getId());
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));

        // Recovered firing: the started invocation is CONSUMED — counted
        // exactly once, honestly recorded — and the message is re-delivered
        // under the next attempt number in the same firing (attempt 1 is
        // never invoked again under its own number, I2).
        queueRetry.executeRetryAttempt(messageId.toString());

        DeadLetterQueueEntry reloaded = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.retryCycleAttempt(reloaded)).isEqualTo(2);
        assertThat(dlq.isAttemptOutcomeRecorded(reloaded)).isTrue();
        assertThat(reloaded.getTotalAttempts()).isEqualTo(3); // seed + consumed + attempt 2
        assertThat(reloaded.getLastError()).isEqualTo("smtp still down");
        verify(handler, times(1)).deliver(messageId);

        // Non-terminal settlements never notify (G15 — only exhaustion does).
        verify(handler, never()).onCycleExhausted(any());

        // The next firing walks the ladder to the terminal state.
        queueRetry.executeRetryAttempt(messageId.toString());
        reloaded = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.isRetryCycleExhausted(reloaded)).isTrue();
        assertThat(dlq.retryCycleAttempt(reloaded)).isEqualTo(3);
        assertThat(reloaded.getTotalAttempts()).isEqualTo(4);
        verify(handler, times(2)).deliver(messageId);
        // The delivery-path exhaustion notified exactly once.
        verify(handler, times(1)).onCycleExhausted(messageId);
    }

    @Test
    void interruptedStartedInvocationAtTheLadderLimitIsConsumedAndTerminal() {
        UUID messageId = UUID.randomUUID();
        var entry = seedRetriedMarker(messageId);
        // Crash simulation on the LAST allowed attempt: attempt 3 was
        // claimed and durably started, its outcome never recorded.
        dlq.claimAttempt(entry.getId(), 3);
        dlq.markInvocationStarted(entry.getId());

        queueRetry.executeRetryAttempt(messageId.toString());

        // CONSUME at the limit: terminal, counted exactly once (honest
        // unknown-outcome accounting), no delivery in the recovery firing
        // (I2 — a started attempt is never invoked again under its own
        // number).
        DeadLetterQueueEntry reloaded = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.isRetryCycleExhausted(reloaded)).isTrue();
        assertThat(dlq.retryCycleAttempt(reloaded)).isEqualTo(3);
        assertThat(reloaded.getTotalAttempts()).isEqualTo(2); // seed + the started invocation
        verify(handler, never()).deliver(any());
        assertThat(queueRetry.jobState(messageId)).isEqualTo("failed");
        // The interrupted-claim settlement is a terminal transition too —
        // the exchange seam is notified exactly once, with no delivery at
        // all on this path (G15: only the worker observes it).
        verify(handler, times(1)).onCycleExhausted(messageId);
        assertThat(reloaded.getFailureReason()).isEqualTo("max_retries_exceeded");
    }

    @Test
    void claimedButNotStartedAtTheLadderLimitIsReleasedAndDelivered() throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        var entry = seedRetriedMarker(messageId);
        queueRetry.scheduleCycle(messageId);
        // The fired one-shot trigger is gone while the durable job remains —
        // the production state of a firing whose process died mid-flight.
        scheduler.unscheduleJob(scheduler.getTriggersOfJob(
                QueueRetryService.jobKey(messageId)).getFirst().getKey());
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));
        // Crash simulation on the LAST allowed attempt: attempts 1 and 2
        // genuinely ran and failed; attempt 3 was durably claimed and the
        // process died BEFORE its invocation started.
        dlq.recordFailedAttempt(entry.getId(), "err", 1, false);
        dlq.recordFailedAttempt(entry.getId(), "err", 2, false);
        dlq.claimAttempt(entry.getId(), 3);
        int totalBeforeRelease = dlq.findByMessageId(messageId).orElseThrow()
                .getTotalAttempts();

        queueRetry.executeRetryAttempt(messageId.toString());

        // RELEASE: the unstarted claim never consumed the budget — no
        // delivery, no exhaustion, counters untouched, the cycle stays live
        // (the disputed zero-delivery loss at the ladder limit is gone).
        verify(handler, never()).deliver(any());
        DeadLetterQueueEntry released = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.isRetryCycleExhausted(released)).isFalse();
        assertThat(released.getTotalAttempts()).isEqualTo(totalBeforeRelease);
        assertThat(queueRetry.jobState(messageId)).isEqualTo("retrying");

        // The marker poll re-arms the SAME attempt number (3).
        queueRetry.consumeRetriedMarkers();
        assertThat(scheduler.getTriggersOfJob(QueueRetryService.jobKey(messageId)))
                .hasSize(1);

        // The re-armed firing delivers under attempt 3; the failed delivery
        // then exhausts the cycle honestly at the limit
        // (total = 1 seed + the three recorded attempts 1/2/3).
        await(CYCLE_TIMEOUT, () -> cycleExhausted(messageId) && jobGone(messageId));
        DeadLetterQueueEntry terminal = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.retryCycleAttempt(terminal)).isEqualTo(3);
        assertThat(terminal.getTotalAttempts()).isEqualTo(totalBeforeRelease + 1);
        verify(handler, times(1)).deliver(messageId);
    }

    @Test
    void crashBeforeTheInvocationNeverConsumesTheBudget() {
        UUID messageId = UUID.randomUUID();
        var entry = seedRetriedMarker(messageId);
        // Three consecutive claim-without-start crashes: every recovery
        // RELEASES the unstarted claim — the ladder position never advances
        // (nothing was delivered and nothing was consumed; I3).
        for (int recovery = 1; recovery <= 3; recovery++) {
            dlq.claimAttempt(entry.getId(), 1);
            queueRetry.executeRetryAttempt(messageId.toString());
            DeadLetterQueueEntry released = dlq.findByMessageId(messageId).orElseThrow();
            assertThat(dlq.isRetryCycleExhausted(released))
                    .as("recovery %d must never exhaust", recovery).isFalse();
            assertThat(released.getTotalAttempts()).isEqualTo(1); // the seed only
            verify(handler, never()).deliver(any());
        }

        // I1 + I2 in one run: a following normal cycle delivers exactly
        // three times and only then exhausts.
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));
        queueRetry.executeRetryAttempt(messageId.toString()); // attempt 1
        queueRetry.executeRetryAttempt(messageId.toString()); // attempt 2
        queueRetry.executeRetryAttempt(messageId.toString()); // attempt 3
        DeadLetterQueueEntry terminal = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.isRetryCycleExhausted(terminal)).isTrue();
        assertThat(dlq.retryCycleAttempt(terminal)).isEqualTo(3);
        assertThat(terminal.getTotalAttempts()).isEqualTo(4); // seed + 3 real invocations
        verify(handler, times(3)).deliver(messageId);
    }

    @Test
    void strandedClaimWithoutAStartIsReleasedByTheMarkerPoll() throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        var entry = seedRetriedMarker(messageId);
        queueRetry.scheduleCycle(messageId);
        // Crash: the one-shot trigger is gone while attempt 1 sits claimed
        // without a start — the durable job is stranded with an in-flight
        // claim.
        scheduler.unscheduleJob(scheduler.getTriggersOfJob(
                QueueRetryService.jobKey(messageId)).getFirst().getKey());
        dlq.claimAttempt(entry.getId(), 1);
        int totalBefore = dlq.findByMessageId(messageId).orElseThrow().getTotalAttempts();

        // The poll RELEASES the unstarted claim (counters untouched) and
        // re-arms the SAME attempt number — no trigger existed, so no
        // in-execution key collision is possible here.
        queueRetry.consumeRetriedMarkers();

        DeadLetterQueueEntry releasedEntry = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.retryCycleAttempt(releasedEntry)).isZero();
        assertThat(releasedEntry.getTotalAttempts()).isEqualTo(totalBefore);
        var triggers = scheduler.getTriggersOfJob(QueueRetryService.jobKey(messageId));
        assertThat(triggers).hasSize(1);
        assertThat(triggers.getFirst().getKey().getName())
                .isEqualTo(messageId.toString() + "-1");

        // The re-armed cycle actually delivers.
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.success());
        await(CYCLE_TIMEOUT, () -> dlq.findByMessageId(messageId).isEmpty()
                && jobGone(messageId));
        verify(handler, times(1)).deliver(messageId);
    }

    @Test
    void invocationStartPersistFailureLeavesTheAttemptReleaseable() {
        UUID messageId = UUID.randomUUID();
        seedRetriedMarker(messageId);
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.success());
        // Fault: persisting the invocation start dies once — the claim is
        // left without a start, nothing is delivered, counters untouched.
        doThrow(new RuntimeException("injected invocation-start failure"))
                .doCallRealMethod()
                .when(dlq).markInvocationStarted(any(UUID.class));
        queueRetry.scheduleCycle(messageId);

        await(CYCLE_TIMEOUT, () -> claimInFlight(messageId, 1) && stranded(messageId));
        verify(handler, never()).deliver(any());
        assertThat(dlq.findByMessageId(messageId).orElseThrow().getTotalAttempts())
                .isEqualTo(1);

        // Loss-free healing: the poll releases the unstarted claim, re-arms
        // the same attempt, and the next invocation starts for real and
        // delivers.
        queueRetry.consumeRetriedMarkers();
        await(CYCLE_TIMEOUT, () -> dlq.findByMessageId(messageId).isEmpty()
                && jobGone(messageId));
        verify(handler, times(1)).deliver(messageId);
    }

    @Test
    void aDeliveryLostToACrashWindowIsRedeliveredNotAssumedDelivered() {
        UUID messageId = UUID.randomUUID();
        var entry = seedRetriedMarker(messageId);
        // Crash simulation: attempt 1 was claimed AND its invocation
        // started; the outcome write never happened — whether the delivery
        // happened is unknowable without a consumer ACK (the duplicate
        // window lives at this START boundary, never before it).
        dlq.claimAttempt(entry.getId(), 1);
        dlq.markInvocationStarted(entry.getId());
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.success());

        // Loss-prevention: the started invocation is consumed and the
        // message is re-delivered (the documented at-least-once duplicate
        // window), never silently assumed delivered.
        queueRetry.executeRetryAttempt(messageId.toString());

        verify(handler, times(1)).deliver(messageId);
        assertThat(dlq.findByMessageId(messageId)).isEmpty();
        assertThat(queueRetry.jobState(messageId)).isEqualTo("completed");
    }

    @Test
    void theTerminalNotificationIsEmittedExactlyOncePerTransition() throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        seedRetriedMarker(messageId);
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));

        queueRetry.consumeRetriedMarkers();
        await(CYCLE_TIMEOUT, () -> cycleExhausted(messageId) && jobGone(messageId));
        verify(handler, times(1)).onCycleExhausted(messageId);

        // No-duplicate proof (G15/G16): repeated firings and repeated
        // marker polls after the terminal commit never notify again — the
        // committed retryCycle.exhausted marker short-circuits every worker
        // entry point.
        queueRetry.executeRetryAttempt(messageId.toString());
        queueRetry.consumeRetriedMarkers();
        queueRetry.consumeRetriedMarkers();
        verify(handler, times(1)).onCycleExhausted(messageId);
    }

    @Test
    void aFailingTerminalNotificationNeverBreaksTheCycle() throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        seedRetriedMarker(messageId);
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));
        // Best-effort proof (G16): the notification fans out AFTER the
        // durable terminal commit — when it fails, the durable state is
        // already terminal and stands as the authoritative record.
        doThrow(new RuntimeException("notification fan-out down"))
                .when(handler).onCycleExhausted(any());

        queueRetry.consumeRetriedMarkers();

        await(CYCLE_TIMEOUT, () -> cycleExhausted(messageId) && jobGone(messageId));
        DeadLetterQueueEntry entry = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.retryCycleAttempt(entry)).isEqualTo(3);
        assertThat(entry.getTotalAttempts()).isEqualTo(4);
        assertThat(entry.getFailureReason()).isEqualTo("max_retries_exceeded");
        assertThat(queueRetry.jobState(messageId)).isEqualTo("failed");
        verify(handler, times(3)).deliver(messageId);
        verify(handler, times(1)).onCycleExhausted(messageId);
    }

    @Test
    void requeueOfATerminalEntryStartsAFreshCycle() throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        seedRetriedMarker(messageId);
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));
        queueRetry.consumeRetriedMarkers();
        await(CYCLE_TIMEOUT, () -> cycleExhausted(messageId) && jobGone(messageId));
        DeadLetterQueueEntry terminal = dlq.findByMessageId(messageId).orElseThrow();
        int totalAfterFirstCycle = terminal.getTotalAttempts();
        assertThat(dlq.isRetryCycleExhausted(terminal)).isTrue();

        // REST-QUEUE-003 path: the manual re-queue of a terminal entry
        // answers success AND restores a FRESH 3-attempt cycle (baseline
        // parity) — it must not silently redeliver nothing.
        var result = queueService.retry(messageId, ACTOR);
        assertThat(result.success()).isTrue();
        DeadLetterQueueEntry requeued = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(requeued.getRetryAttempt()).isTrue();            // P0 flag untouched
        assertThat(dlq.isRetryCycleExhausted(requeued)).isFalse();  // terminal state cleared
        assertThat(dlq.retryCycleAttempt(requeued)).isZero();       // fresh cycle
        assertThat(requeued.getTotalAttempts()).isEqualTo(totalAfterFirstCycle);

        // The fresh cycle runs: 3 new invocations, terminal again, the
        // row-lifetime counter accumulates (1 seed + 3 + 3).
        queueRetry.consumeRetriedMarkers();
        await(CYCLE_TIMEOUT, () -> cycleExhausted(messageId) && jobGone(messageId));
        DeadLetterQueueEntry terminalAgain = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.retryCycleAttempt(terminalAgain)).isEqualTo(3);
        assertThat(terminalAgain.getTotalAttempts()).isEqualTo(totalAfterFirstCycle + 3);
        verify(handler, times(6)).deliver(messageId); // 3 + 3 real invocations
        // The second exhaustion is a NEW transition (the manual re-queue
        // cleared the terminal marker): it legitimately notifies again —
        // two transitions, two notifications, never a duplicate (G15/G16).
        verify(handler, times(2)).onCycleExhausted(messageId);
    }

    @Test
    void requeueOfALiveCycleDoesNotResetIt() {
        UUID messageId = UUID.randomUUID();
        var entry = seedRetriedMarker(messageId);
        // A live (non-terminal) cycle: attempt 1 ran and failed; the cycle
        // is mid-flight on the ladder.
        dlq.recordFailedAttempt(entry.getId(), "err", 1, false);

        queueService.retry(messageId, ACTOR);

        // A live cycle is left exactly as it was (idempotent with the
        // previous markRetried behavior) — only terminal cycles are reset.
        DeadLetterQueueEntry requeued = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(requeued.getRetryAttempt()).isTrue();
        assertThat(dlq.retryCycleAttempt(requeued)).isEqualTo(1);
        assertThat(dlq.isAttemptOutcomeRecorded(requeued)).isTrue();
        assertThat(dlq.isRetryCycleExhausted(requeued)).isFalse();
        assertThat(requeued.getTotalAttempts()).isEqualTo(2);
    }

    @Test
    void theP0OnceOnlyFlagIsUnchanged() {
        UUID messageId = UUID.randomUUID();
        var conversation = conversations.save(new com.yacc.entity.Conversation(
                UUID.randomUUID(), com.yacc.entity.ChannelType.IRC, "#retry-p0"));
        var message = messages.save(new com.yacc.entity.Message(messageId,
                conversation.getId(), null, "yacc", "body",
                com.yacc.entity.MessageDirection.OUTBOUND));
        message.setStatus(com.yacc.entity.MessageStatus.FAILED);
        messages.save(message);
        DeadLetterQueueEntry entry = dlq.enqueue(messageId, conversation.getId(),
                "{\"origin\":\"mig-063-test\"}", "platform_error", 1, "initial failure",
                null, null);
        dlq.markRetried(entry.getId(), ACTOR);
        Mockito.<RetryDeliveryHandler.RetryOutcome>when(handler.deliver(any()))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("smtp still down"));
        queueRetry.consumeRetriedMarkers();
        await(CYCLE_TIMEOUT, () -> cycleExhausted(messageId) && jobGone(messageId));

        // The terminal-cycle clear on a manual re-queue does NOT relax the
        // frozen P0 once-only rule: the marker stays true and the
        // REST-MSG-003 path (MessageService.retry) still rejects.
        queueService.retry(messageId, ACTOR);
        DeadLetterQueueEntry requeued = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(requeued.getRetryAttempt()).isTrue();
        assertThatThrownBy(() -> messageService.retry(conversation.getId(), messageId,
                ACTOR.toString()))
                .isInstanceOf(com.yacc.common.controller.BadRequestException.class)
                .hasMessageContaining("already been retried");
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
