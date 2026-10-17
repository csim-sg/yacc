package com.yacc.api.dlq;

import org.quartz.Job;
import org.quartz.JobExecutionContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.yacc.service.DlqService;

/**
 * The Quartz DLQ retention job (MIG-063; ADR-028 — Quartz owns retry/DLQ
 * processing): enforces the 7-day retention every {@code enqueue} writes by
 * removing expired rows in bounded, independently committed batches.
 * Registered once as a durable job by {@link DlqRetentionSchedule}; a
 * firing missed while the process was down fires immediately on restart
 * (misfire = FIRE_NOW).
 *
 * <p>Thin adapter by design: the bounded sweep lives in
 * {@link DlqService#removeExpiredEntries()}. Jobs are instantiated per
 * firing by Boot's default {@code SpringBeanJobFactory} (constructor DI,
 * ARCH-004 §2). One firing can never grow unboundedly — the per-call bound
 * is {@code DlqService}'s sweep cap — and overlap is harmless (idempotent
 * deletes).</p>
 */
public class DlqRetentionJob implements Job {

    private static final Logger log = LoggerFactory.getLogger(DlqRetentionJob.class);

    private final DlqService dlq;

    public DlqRetentionJob(DlqService dlq) {
        this.dlq = dlq;
    }

    @Override
    public void execute(JobExecutionContext context) {
        int removed = dlq.removeExpiredEntries();
        if (removed > 0) {
            log.info("DLQ retention sweep removed {} expired entries (7-day retention)",
                    removed);
        }
    }
}
