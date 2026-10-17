package com.yacc.api.dlq;

import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.TriggerBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Registers the durable Quartz DLQ retention sweep (MIG-063; ADR-028 —
 * Quartz owns retry/DLQ processing): the 7-day retention every
 * {@code enqueue} writes is enforced by the hourly sweep
 * ({@link DlqRetentionJob} over {@code DlqService.removeExpiredEntries()}).
 *
 * <p>The job persists in the JDBC store, so the registration is idempotent
 * across restarts ({@code checkExists} guard — re-booting never
 * double-schedules); the first fire is immediate and misfires fire now on
 * recovery. Registration failure is logged, never fatal: the sweep is
 * storage hygiene — the expired rows are simply swept at the next
 * successful registration/boot.</p>
 */
@Component
public class DlqRetentionSchedule {

    private static final Logger log = LoggerFactory.getLogger(DlqRetentionSchedule.class);

    /**
     * Quartz identity of the durable retention sweep (job and trigger share
     * the name/group; hygiene cadence, not a contract value).
     */
    public static final String SWEEP_NAME = "dlq-retention";
    public static final String SWEEP_GROUP = "dlq-retention";

    private final Scheduler scheduler;

    public DlqRetentionSchedule(Scheduler scheduler) {
        this.scheduler = scheduler;
    }

    /** Registers the sweep once after the context (and Flyway) is ready. */
    @EventListener(ApplicationReadyEvent.class)
    public void registerOnStartup() {
        try {
            register();
        } catch (SchedulerException failure) {
            log.error("DLQ retention sweep registration failed (non-fatal; the next"
                    + " boot re-registers): {}", failure.toString());
        }
    }

    /** Idempotent registration of the durable sweep job + hourly trigger. */
    void register() throws SchedulerException {
        JobDetail job = JobBuilder.newJob(DlqRetentionJob.class)
                .withIdentity(SWEEP_NAME, SWEEP_GROUP)
                .withDescription("MIG-063 DLQ 7-day retention sweep (ADR-028)")
                .storeDurably(true)
                .build();
        if (scheduler.checkExists(job.getKey())) {
            return;
        }
        scheduler.scheduleJob(job, TriggerBuilder.newTrigger()
                .withIdentity(SWEEP_NAME, SWEEP_GROUP)
                .forJob(job.getKey())
                .withSchedule(SimpleScheduleBuilder.simpleSchedule()
                        .withIntervalInHours(1)
                        .repeatForever()
                        .withMisfireHandlingInstructionFireNow())
                .build());
        log.info("DLQ retention sweep registered (hourly; 7-day retention)");
    }
}
