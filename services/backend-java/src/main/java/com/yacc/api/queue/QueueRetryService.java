package com.yacc.api.queue;

import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.quartz.impl.matchers.GroupMatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.yacc.entity.DeadLetterQueueEntry;
import com.yacc.service.DlqService;

/**
 * The DB-backed Quartz retry worker (MIG-063; ADR-028): schedules and
 * executes redelivery cycles over the DB DLQ, replacing the POC's
 * Redis/BullMQ retry queue (the POC wire vocabulary survives only where the
 * frozen REST-QUEUE surfaces require it).
 *
 * <p>Lifecycle: a DLQ entry marked retried (the once-only marker from
 * REST-QUEUE-003 / REST-DLQ-003 / REST-MSG-003) is consumed by the
 * marker poll, which schedules a Quartz cycle — job key = the opaque
 * messageId string (REST-QUEUE-006 1:1 identity, contract-canonicalization
 * §5 Note 5). Each firing performs one redelivery attempt through the
 * {@link RetryDeliveryHandler} seam; a failed attempt persists the attempt
 * counter on the DLQ row and reschedules the next single-fire trigger on
 * the frozen backoff ladder (1m &rarr; 5m &rarr; 30m, max {@code maxAttempts}
 * per cycle); exhaustion records the terminal state on the DLQ row and
 * deletes the job; success clears the DLQ row (POC clear-on-resolve
 * parity). Jobs are durable + recovery-requested in the JDBC store, so
 * scheduled redelivery survives a restart (misfires fire immediately on
 * reboot).</p>
 *
 * <p><b>Crash safety — the claim/invocation protocol (I1&ndash;I3), no
 * exactly-once claim:</b> the frozen contract has no consumer
 * acknowledgement, so exactly-once delivery is impossible and is not
 * claimed. The frozen quantity is a <em>delivery attempt</em> = one
 * invocation of the delivery boundary — a durable bookkeeping write never
 * consumes the budget. The worker therefore separates a durable attempt
 * <em>claim</em> ({@code claimAttempt}: "assigned, not started") from a
 * durably <em>started</em> invocation ({@code markInvocationStarted}: the
 * last durable step immediately before {@code handler.deliver}, with no
 * I/O in between), and every recovery settles the persisted state
 * tri-state: an outcome was recorded &rarr; nothing in flight; started
 * without an outcome &rarr; the invocation is conservatively consumed
 * (counted, honestly recorded — its delivery may or may not have
 * happened); a claim without a start &rarr; released, never consumed — the
 * same attempt number is re-armed by the marker poll and delivered. The
 * invariants: <b>(I1) no loss</b> — a cycle can reach {@code exhausted}
 * only after {@code maxAttempts} durably started invocations, so a crash
 * that prevents a delivery never consumes it; <b>(I2) termination</b> — a
 * started attempt is never invoked again under its own number, so a cycle
 * carries out at most {@code maxAttempts} deliveries (no unbounded crash
 * loop, no unbounded external side effects); <b>(I3) honest accounting</b>
 * — {@code total_attempts}, {@code last_error} and the wire
 * {@code attempts}/{@code state} advance only with real invocations.
 * Residual (documented, not hidden): the single in-process gap between the
 * invocation-start commit and the {@code deliver} call contains no I/O and
 * no user code; its resolution is conservative consumption (preserves I2)
 * — the delivery may have happened, so the duplicate window lives at the
 * START boundary and exactly-once is still not claimed; the DLQ row is
 * never deleted by that path, so the message stays visible and
 * ops-recoverable ({@code failed}, retained 7 days). Liveness of the
 * released case: a process that repeatedly dies between its claim and the
 * invocation start re-arms the same attempt indefinitely — a PROCESS
 * crash-loop, not a message loop: nothing is delivered, it cannot be
 * induced by message content, and it is visible (WARN log +
 * {@code jobState=retrying} + the DLQ row) and bounded by the frozen 7-day
 * DLQ retention sweep plus the orphan-job sweep. <b>No re-arm cap is
 * introduced</b> — any cap that terminates the cycle reintroduces exactly
 * this loss. The handler seam is documented to tolerate repeated
 * {@code deliver} calls keyed by messageId.</p>
 *
 * <p><b>Self-healing scheduling:</b> cycle state lives on the DLQ row,
 * never in RAM. A durable job can be left without a trigger when the
 * persistence or reschedule step fails between the one-shot fire and the
 * next schedule; the marker poll re-arms such a job by rebuilding its next
 * trigger from the persisted state and removes durable jobs whose DLQ row
 * no longer exists — a stranded cycle cannot stay stranded longer than one
 * poll interval.</p>
 *
 * <p>Singleton posture: one non-clustered, in-process scheduler on a single
 * backend instance (ADR-024/029). Every step is idempotent-safe under
 * repeated markers/recovered firings (the persisted attempt counter is the
 * cycle state, the job-key existence check is the schedule guard); failures
 * inside a step degrade to logged best-effort that the next poll heals.</p>
 */
@Service
public class QueueRetryService {

    private static final Logger log = LoggerFactory.getLogger(QueueRetryService.class);

    /**
     * Quartz key group — POC queue name {@code message-retry-queue} parity
     * (the BullMQ vocabulary survives as wire vocabulary only).
     */
    public static final String JOB_GROUP = "message-retry";

    private static final String TRIGGER_GROUP = "message-retry";

    private final Scheduler scheduler;
    private final DlqService dlq;
    private final QueueRetryProperties properties;
    private final RetryDeliveryHandler handler;

    public QueueRetryService(Scheduler scheduler, DlqService dlq,
            QueueRetryProperties properties, RetryDeliveryHandler handler) {
        this.scheduler = scheduler;
        this.dlq = dlq;
        this.properties = properties;
        this.handler = handler;
    }

    /**
     * Schedules the retry cycle for a DLQ-backed message: a durable,
     * recovery-requested {@link RetryJob} whose first attempt fires after
     * the first backoff step. Idempotent — a message with a live job is
     * skipped (repeated markers/recovered firings never double-schedule),
     * and a durable job stranded <em>without</em> a trigger is re-armed
     * from the persisted cycle state (self-healing, see
     * {@link #resumeStrandedCycle}).
     */
    public void scheduleCycle(UUID messageId) {
        JobKey key = jobKey(messageId);
        try {
            if (scheduler.checkExists(key)) {
                resumeStrandedCycle(messageId, key);
                return;
            }
            int firstAttempt = dlq.findByMessageId(messageId)
                    .map(dlq::retryCycleAttempt).orElse(0) + 1;
            JobDetail job = JobBuilder.newJob(RetryJob.class)
                    .withIdentity(key)
                    .withDescription("MIG-063 redelivery for message " + messageId)
                    .storeDurably(true)
                    .requestRecovery(true)
                    .build();
            scheduler.scheduleJob(job, triggerFor(messageId, firstAttempt));
            log.info("Message enqueued for retry: {} (first attempt in {} ms)", messageId,
                    properties.delayBeforeAttempt(firstAttempt));
        } catch (SchedulerException failure) {
            throw new IllegalStateException("Quartz retry scheduling failed for " + messageId,
                    failure);
        }
    }

    /**
     * Scheduled retried-marker consumption (the {@code retry_attempt = true}
     * markers of the DLQ rows) plus the durable-job reconciliation: live
     * cycles are skipped, stranded cycles (durable job, no trigger) are
     * re-armed from the persisted state, and orphaned jobs (no DLQ row) are
     * removed. Repeated polls are no-ops.
     */
    @Scheduled(fixedDelayString = "${yacc.queue.retry.marker-poll-interval-ms}")
    public void consumeRetriedMarkers() {
        List<DeadLetterQueueEntry> markers = dlq.retriedEntries();
        for (DeadLetterQueueEntry entry : markers) {
            if (dlq.isRetryCycleExhausted(entry)) {
                continue;
            }
            try {
                scheduleCycle(entry.getMessageId());
            } catch (RuntimeException failure) {
                log.error("Failed to schedule the retry cycle for {}: {}",
                        entry.getMessageId(), failure.toString());
            }
        }
        removeOrphanedJobs();
    }

    /**
     * One redelivery attempt (a Quartz firing) under the claim/invocation
     * protocol: settle any interrupted state left by a previous execution
     * (tri-state — see {@link #settleInterruptedClaim}), durably claim this
     * attempt, durably mark the invocation started as the last step before
     * the delivery, then persist the outcome. The attempt counter and the
     * exhaustion marker live on the DLQ row's metadata, so replayed or
     * recovered firings keep counting correctly.
     *
     * <p>On a RELEASED settlement this firing delivers nothing and re-arms
     * nothing: the fired trigger key {@code messageId-N} still exists until
     * the execution returns (an in-execution re-arm of the same attempt
     * would collide — {@code ObjectAlreadyExistsException}), so the durable
     * job is deliberately left without a trigger and the marker poll
     * re-arms the same attempt N through {@link #resumeStrandedCycle}.</p>
     *
     * @param messageIdValue the job key name — the opaque messageId string
     */
    public void executeRetryAttempt(String messageIdValue) {
        UUID messageId;
        try {
            messageId = UUID.fromString(messageIdValue);
        } catch (IllegalArgumentException invalid) {
            log.error("Redelivery job key is not a message id: {}", messageIdValue);
            return;
        }
        var entry = dlq.findByMessageId(messageId).orElse(null);
        if (entry == null) {
            removeJobQuietly(messageId, "the DLQ entry no longer exists");
            return;
        }
        if (dlq.isRetryCycleExhausted(entry)) {
            removeJobQuietly(messageId, "the retry cycle is exhausted");
            return;
        }
        ClaimSettlement settlement = settleInterruptedClaim(entry);
        if (settlement == ClaimSettlement.CONSUMED_EXHAUSTED) {
            removeJobQuietly(messageId, "the interrupted invocation exhausted the cycle");
            return;
        }
        if (settlement == ClaimSettlement.RELEASED) {
            // Never deliver in this firing and never re-arm in-execution:
            // the 30 s marker poll re-arms the same attempt (loss-free).
            return;
        }
        var current = dlq.findByMessageId(messageId).orElse(null);
        if (current == null) {
            removeJobQuietly(messageId, "the DLQ entry no longer exists");
            return;
        }
        if (dlq.isRetryCycleExhausted(current)) {
            removeJobQuietly(messageId, "the retry cycle is exhausted");
            return;
        }
        int attempt = dlq.retryCycleAttempt(current) + 1;
        current = dlq.claimAttempt(current.getId(), attempt);
        try {
            // T2 — the last durable step before the delivery call; a failure
            // here leaves the claim unstarted: releaseable by the marker
            // poll and re-delivered under the same attempt (never consumed).
            dlq.markInvocationStarted(current.getId());
        } catch (RuntimeException failure) {
            log.error("Failed to persist the invocation start for {} (attempt {}): {}"
                    + " — the claim stays releaseable and is re-armed by the marker poll",
                    messageId, attempt, failure.toString());
            return;
        }
        RetryDeliveryHandler.RetryOutcome outcome;
        try {
            outcome = handler.deliver(messageId);
        } catch (RuntimeException failure) {
            // The handler owns delivery; a throw is a failed attempt — never
            // let it surface into the scheduler as a trigger ERROR state.
            log.warn("Redelivery handler threw for {} (attempt {}): {}",
                    messageId, attempt, failure.toString());
            outcome = RetryDeliveryHandler.RetryOutcome.failure(failure.toString());
        }
        if (outcome == null) {
            // Contract violation guard: a null outcome is a failed attempt —
            // never a job-crashing state on the scheduler thread.
            outcome = RetryDeliveryHandler.RetryOutcome.failure(
                    "redelivery handler returned no outcome");
        }
        if (outcome.delivered()) {
            dlq.clearByMessageId(messageId);
            removeJobQuietly(messageId, "delivered");
            log.info("Retry job completed — message {} delivered on attempt {}", messageId,
                    attempt);
            return;
        }
        boolean exhausted = attempt >= properties.maxAttempts();
        String error = (outcome.error() == null || outcome.error().isBlank())
                ? "unknown redelivery failure"
                : outcome.error();
        dlq.recordFailedAttempt(current.getId(), error, attempt, exhausted);
        if (exhausted) {
            removeJobQuietly(messageId, "retry cycle exhausted (max_retries_exceeded)");
            log.error("Retry cycle exhausted for message {} after {} attempts — DLQ terminal",
                    messageId, attempt);
        } else {
            rescheduleQuietly(messageId, attempt + 1);
        }
    }

    /** Tri-state settlement result for an interrupted redelivery state. */
    private enum ClaimSettlement {
        /** Nothing in flight — the caller proceeds on its normal path. */
        NONE,
        /**
         * An unstarted claim was released: it never consumed the budget; the
         * same attempt number must be re-armed by the marker poll and the
         * firing must deliver nothing.
         */
        RELEASED,
        /** A started invocation without an outcome was consumed; continue. */
        CONSUMED,
        /** A started invocation without an outcome was consumed — terminal. */
        CONSUMED_EXHAUSTED
    }

    /**
     * Crash-safety settlement (tri-state, shared by
     * {@link #executeRetryAttempt} and {@link #resumeStrandedCycle} — no
     * divergent copy):
     *
     * <ul>
     *   <li>{@code failed=true} — the outcome was recorded: nothing in
     *       flight ({@link ClaimSettlement#NONE});</li>
     *   <li>{@code started=true} without an outcome — the invocation began
     *       but its delivery outcome is unknowable (no consumer ACK in the
     *       frozen contract): the attempt is consumed — counted once,
     *       honestly recorded, exhausted at the ladder limit, and never
     *       invoked again under its own number (I2);</li>
     *   <li>a claim with neither — the invocation never started: the claim
     *       is <b>released</b> ({@code attempt = N-1}, counters untouched)
     *       and the same attempt N is re-armed; the message is re-delivered
     *       under its own number, so a crash before a delivery can never
     *       silently drop it (I1).</li>
     * </ul>
     */
    private ClaimSettlement settleInterruptedClaim(DeadLetterQueueEntry entry) {
        int claimed = dlq.retryCycleAttempt(entry);
        if (claimed == 0 || dlq.isAttemptOutcomeRecorded(entry)) {
            return ClaimSettlement.NONE;
        }
        if (!dlq.isInvocationStarted(entry)) {
            dlq.releaseClaim(entry.getId());
            log.warn("Released the unstarted redelivery claim of message {} (attempt {} was"
                            + " assigned but its invocation never began) — attempt {} re-armed by"
                            + " the marker poll, budget untouched",
                    entry.getMessageId(), claimed, claimed);
            return ClaimSettlement.RELEASED;
        }
        boolean exhausted = claimed >= properties.maxAttempts();
        dlq.recordFailedAttempt(entry.getId(),
                "redelivery attempt " + claimed
                        + " started but its outcome was never recorded (crash recovery)",
                claimed, exhausted);
        log.warn("Settled the interrupted redelivery invocation of message {} (attempt {}{})",
                entry.getMessageId(), claimed, exhausted ? " — cycle exhausted" : "");
        return exhausted ? ClaimSettlement.CONSUMED_EXHAUSTED : ClaimSettlement.CONSUMED;
    }

    /**
     * Baseline job-state mapping for the REST-QUEUE-006 surface (the frozen
     * vocabulary {@code pending|processing|completed|failed|retrying|dlq},
     * contract-canonicalization §5 Note 5): a live trigger maps from its
     * Quartz state; a stranded cycle (durable job, no trigger — the marker
     * poll re-arms it) maps from the persisted DLQ state; a terminal
     * message maps from its DLQ row — a DLQ-backed message whose cycle is
     * gone is the baseline {@code failed} job (the MIG-040 surface pinned
     * the not-yet-retried entry as {@code failed}, POC getQueueJob
     * semantics), and a cleared row is {@code completed}.
     */
    public String jobState(UUID messageId) {
        try {
            JobKey key = jobKey(messageId);
            if (scheduler.checkExists(key)) {
                var triggers = scheduler.getTriggersOfJob(key);
                if (!triggers.isEmpty()) {
                    return switch (scheduler.getTriggerState(triggers.getFirst().getKey())) {
                        case BLOCKED -> "processing";
                        case PAUSED -> "pending";
                        case COMPLETE -> "completed";
                        case ERROR -> "failed";
                        default -> "retrying";
                    };
                }
                return dlq.findByMessageId(messageId)
                        .map(entry -> dlq.isRetryCycleExhausted(entry)
                                ? "failed"
                                : "retrying")
                        .orElse("completed");
            }
        } catch (SchedulerException failure) {
            log.error("Quartz state lookup failed for {}: {}", messageId, failure.toString());
        }
        return dlq.findByMessageId(messageId).isEmpty() ? "completed" : "failed";
    }

    /**
     * Self-healing for a durable job left with no trigger (a persistence or
     * reschedule failure between the one-shot fire and the next schedule,
     * or a RELEASED settlement whose firing could not re-arm in-execution):
     * the interrupted state is settled (tri-state, the same settlement as
     * the firing path) and the next trigger is rebuilt from the persisted
     * state, so the ladder and the attempt counter continue exactly where
     * the row says — a released claim sits at {@code N-1}, so the SAME
     * attempt N re-arms here (no collision: no trigger exists); a consumed
     * or recorded attempt at N re-arms N+1. A live job with a pending
     * trigger is a no-op; a job whose entry is gone or whose cycle is
     * terminal is removed.
     */
    private void resumeStrandedCycle(UUID messageId, JobKey key) throws SchedulerException {
        if (!scheduler.getTriggersOfJob(key).isEmpty()) {
            return;
        }
        var entry = dlq.findByMessageId(messageId).orElse(null);
        if (entry == null) {
            removeJobQuietly(messageId, "the DLQ entry no longer exists");
            return;
        }
        if (dlq.isRetryCycleExhausted(entry)) {
            removeJobQuietly(messageId, "the retry cycle is exhausted");
            return;
        }
        if (settleInterruptedClaim(entry) == ClaimSettlement.CONSUMED_EXHAUSTED) {
            removeJobQuietly(messageId, "the interrupted invocation exhausted the cycle");
            return;
        }
        var current = dlq.findByMessageId(messageId).orElse(null);
        if (current == null) {
            removeJobQuietly(messageId, "the DLQ entry no longer exists");
            return;
        }
        if (dlq.isRetryCycleExhausted(current)) {
            removeJobQuietly(messageId, "the retry cycle is exhausted");
            return;
        }
        int nextAttempt = dlq.retryCycleAttempt(current) + 1;
        scheduler.scheduleJob(triggerFor(messageId, nextAttempt));
        log.warn("Resumed a stranded retry cycle for {} — attempt {} re-armed from the"
                + " persisted state", messageId, nextAttempt);
    }

    /**
     * Removes durable retry jobs whose DLQ row no longer exists (the row
     * was cleared while the job removal failed) — the marker loop cannot
     * see them, so the poll sweeps the group.
     */
    private void removeOrphanedJobs() {
        try {
            for (JobKey key : scheduler.getJobKeys(GroupMatcher.jobGroupEquals(JOB_GROUP))) {
                UUID messageId;
                try {
                    messageId = UUID.fromString(key.getName());
                } catch (IllegalArgumentException unparseable) {
                    continue;
                }
                if (dlq.findByMessageId(messageId).isPresent()) {
                    continue;
                }
                try {
                    if (scheduler.deleteJob(key)) {
                        log.info("Removed orphaned retry job {} — the DLQ entry no longer"
                                + " exists", key);
                    }
                } catch (SchedulerException failure) {
                    log.error("Failed to remove the orphaned retry job {}: {}",
                            key, failure.toString());
                }
            }
        } catch (SchedulerException failure) {
            log.error("Orphaned retry job sweep failed: {}", failure.toString());
        }
    }

    /** Job key: the name is the opaque messageId string (1:1 identity). */
    static JobKey jobKey(UUID messageId) {
        return JobKey.jobKey(messageId.toString(), JOB_GROUP);
    }

    /**
     * Single-fire trigger for one attempt, offset by the frozen backoff
     * ladder; a fire missed while the process was down fires immediately on
     * restart (misfire = FIRE_NOW — the restart-durability behavior). The
     * trigger key is unique per attempt: the fired trigger is removed only
     * after the execution returns, so an in-execution reschedule under the
     * same key would collide (ObjectAlreadyExistsException).
     */
    private Trigger triggerFor(UUID messageId, int attempt) {
        return TriggerBuilder.newTrigger()
                .withIdentity(TriggerKey.triggerKey(
                        messageId.toString() + "-" + attempt, TRIGGER_GROUP))
                .forJob(jobKey(messageId))
                .startAt(Date.from(Instant.now()
                        .plusMillis(properties.delayBeforeAttempt(attempt))))
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withRepeatCount(0)
                        .withMisfireHandlingInstructionFireNow())
                .build();
    }

    private void rescheduleQuietly(UUID messageId, int nextAttempt) {
        try {
            scheduler.scheduleJob(triggerFor(messageId, nextAttempt));
            log.info("Retry job failed for message {} — next attempt scheduled in {} ms",
                    messageId, properties.delayBeforeAttempt(nextAttempt));
        } catch (SchedulerException failure) {
            log.error("Failed to schedule attempt {} for {}: {}", nextAttempt, messageId,
                    failure.toString());
        }
    }

    private void removeJobQuietly(UUID messageId, String reason) {
        try {
            scheduler.deleteJob(jobKey(messageId));
        } catch (SchedulerException failure) {
            log.error("Failed to remove the retry job for {} ({}): {}", messageId, reason,
                    failure.toString());
        }
    }
}
