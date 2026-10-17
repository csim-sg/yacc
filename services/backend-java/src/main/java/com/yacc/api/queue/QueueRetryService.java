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
 * <p>Singleton posture: one non-clustered, in-process scheduler on a single
 * backend instance (ADR-024/029). Every step is idempotent-safe under
 * repeated markers/recovered firings (the persisted attempt counter is the
 * cycle state, the job-key existence check is the schedule guard); failures
 * inside a step degrade to logged best-effort instead of masking the
 * cycle.</p>
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
     * skipped (repeated markers/recovered firings never double-schedule).
     */
    public void scheduleCycle(UUID messageId) {
        JobKey key = jobKey(messageId);
        try {
            if (scheduler.checkExists(key)) {
                return;
            }
            JobDetail job = JobBuilder.newJob(RetryJob.class)
                    .withIdentity(key)
                    .withDescription("MIG-063 redelivery for message " + messageId)
                    .storeDurably(true)
                    .requestRecovery(true)
                    .build();
            scheduler.scheduleJob(job, triggerFor(messageId, 1));
        } catch (SchedulerException failure) {
            throw new IllegalStateException("Quartz retry scheduling failed for " + messageId,
                    failure);
        }
        log.info("Message enqueued for retry: {} (first attempt in {} ms)", messageId,
                properties.delayBeforeAttempt(1));
    }

    /**
     * Scheduled retried-marker consumption (the {@code retry_attempt = true}
     * markers of the DLQ rows). The once-only marker stays true forever, so
     * consumption is guarded: exhausted cycles are terminal, and a message
     * with a live job is skipped — repeated polls are no-ops.
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
    }

    /**
     * One redelivery attempt (a Quartz firing). The attempt counter and the
     * exhaustion marker are persisted on the DLQ row's metadata, so replayed
     * or recovered firings keep counting correctly.
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
        int attempt = dlq.retryCycleAttempt(entry) + 1;
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
        int totalAttempts = (entry.getTotalAttempts() == null ? 0 : entry.getTotalAttempts()) + 1;
        dlq.recordFailedAttempt(entry.getId(), error, totalAttempts, attempt, exhausted);
        if (exhausted) {
            removeJobQuietly(messageId, "retry cycle exhausted (max_retries_exceeded)");
            log.error("Retry cycle exhausted for message {} after {} attempts — DLQ terminal",
                    messageId, attempt);
        } else {
            rescheduleQuietly(messageId, attempt + 1);
        }
    }

    /**
     * Baseline job-state mapping for the REST-QUEUE-006 surface (the frozen
     * vocabulary {@code pending|processing|completed|failed|retrying|dlq},
     * contract-canonicalization §5 Note 5): a live trigger maps from its
     * Quartz state; a terminal message maps from its DLQ row — a DLQ-backed
     * message whose cycle is gone is the baseline {@code failed} job (the
     * MIG-040 surface pinned the not-yet-retried entry as {@code failed},
     * POC getQueueJob semantics), and a cleared row is {@code completed}.
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
            }
        } catch (SchedulerException failure) {
            log.error("Quartz state lookup failed for {}: {}", messageId, failure.toString());
        }
        return dlq.findByMessageId(messageId).isEmpty() ? "completed" : "failed";
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
