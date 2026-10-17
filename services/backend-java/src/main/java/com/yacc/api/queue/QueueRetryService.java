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
 * <p><b>Crash safety — at-least-once redelivery, no exactly-once claim:</b>
 * the frozen contract has no consumer acknowledgement, so a crash between
 * a delivery and its durable outcome write is unresolvable in both
 * directions. The worker therefore persists a durable attempt
 * <em>claim</em> (the DLQ row's {@code retryCycle} metadata) <b>before</b>
 * every delivery and treats a claim whose outcome was never recorded as an
 * interrupted execution: the attempt is consumed and honestly recorded
 * (counted against the ladder) and the message is re-delivered under the
 * next attempt number. A duplicate delivery in that crash window is
 * possible; losing the message or retrying unbounded is not. Exactly-once
 * delivery would require a consumer ACK/protocol change (MIG-062+ routing)
 * and is deliberately not claimed here. The handler seam is documented to
 * tolerate repeated {@code deliver} calls keyed by messageId.</p>
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
     * One redelivery attempt (a Quartz firing) under the crash-safety
     * protocol: settle any interrupted claim left by a previous execution,
     * durably claim this attempt <b>before</b> delivering, then persist the
     * outcome. The attempt counter and the exhaustion marker live on the
     * DLQ row's metadata, so replayed or recovered firings keep counting
     * correctly.
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
        if (settleInterruptedClaim(entry)) {
            removeJobQuietly(messageId, "the interrupted claim exhausted the cycle");
            return;
        }
        int attempt = dlq.retryCycleAttempt(entry) + 1;
        entry = dlq.claimAttempt(entry.getId(), attempt);
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
        dlq.recordFailedAttempt(entry.getId(), error, attempt, exhausted);
        if (exhausted) {
            removeJobQuietly(messageId, "retry cycle exhausted (max_retries_exceeded)");
            log.error("Retry cycle exhausted for message {} after {} attempts — DLQ terminal",
                    messageId, attempt);
        } else {
            rescheduleQuietly(messageId, attempt + 1);
        }
    }

    /**
     * Crash-safety settlement: a durable claim without a recorded outcome
     * means the previous execution was interrupted somewhere between the
     * claim and the outcome write — whether its delivery happened is
     * unknowable without a consumer acknowledgement (the frozen contract
     * has none). The interrupted attempt is consumed and honestly recorded
     * (counted against the ladder — never silently assumed delivered, never
     * retried unbounded); the caller continues with the next attempt
     * number, re-delivering the message unless this was the last allowed
     * attempt (at-least-once, loss-prevention). Returns {@code true} when
     * the interrupted claim exhausted the cycle (terminal).
     */
    private boolean settleInterruptedClaim(DeadLetterQueueEntry entry) {
        int claimed = dlq.retryCycleAttempt(entry);
        if (claimed == 0 || dlq.isAttemptOutcomeRecorded(entry)) {
            return false;
        }
        boolean exhausted = claimed >= properties.maxAttempts();
        dlq.recordFailedAttempt(entry.getId(),
                "redelivery attempt " + claimed
                        + " was interrupted before its outcome was recorded (crash recovery)",
                claimed, exhausted);
        log.warn("Settled the interrupted redelivery claim of message {} (attempt {}{})",
                entry.getMessageId(), claimed, exhausted ? " — cycle exhausted" : "");
        return exhausted;
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
     * reschedule failure between the one-shot fire and the next schedule):
     * the next trigger is rebuilt from the persisted cycle state, so the
     * ladder and the attempt counter continue exactly where the row says.
     * A live job with a pending trigger is a no-op; a job whose entry is
     * gone or whose cycle is terminal is removed.
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
        if (settleInterruptedClaim(entry)) {
            removeJobQuietly(messageId, "the interrupted claim exhausted the cycle");
            return;
        }
        int nextAttempt = dlq.retryCycleAttempt(entry) + 1;
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
