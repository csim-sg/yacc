package com.yacc.api.queue;

import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobExecutionContext;

/**
 * The Quartz redelivery job (MIG-063; ADR-028). One execution = one
 * redelivery attempt for the DLQ-backed job identified by the job key: the
 * key <b>name is the opaque messageId string</b> — Quartz identity
 * substitutes 1:1 for the former BullMQ jobId (REST-QUEUE-006;
 * contract-canonicalization §5 Note 5).
 *
 * <p>Thin adapter by design: all behavior lives in {@link QueueRetryService}
 * and all cycle state (attempt counter, exhaustion marker) is persisted on
 * the DLQ row's metadata, so recovered/replayed firings keep counting
 * correctly. Jobs are instantiated per firing by Boot's default
 * {@code SpringBeanJobFactory}, whose {@code createBean} resolves the single
 * constructor from the context — constructor DI preserved (ARCH-004 §2).</p>
 *
 * <p>{@link DisallowConcurrentExecution @DisallowConcurrentExecution} is
 * load-bearing for the claim/invocation protocol: it keeps the intermediate
 * claim-without-start state from being observed by the marker poll while a
 * firing is in flight (the poll additionally no-ops while the fired
 * trigger is still present); the cross-job worker concurrency is the
 * Quartz thread pool (5, baseline parity).</p>
 */
@DisallowConcurrentExecution
public class RetryJob implements Job {

    private final QueueRetryService retries;

    public RetryJob(QueueRetryService retries) {
        this.retries = retries;
    }

    @Override
    public void execute(JobExecutionContext context) {
        retries.executeRetryAttempt(context.getJobDetail().getKey().getName());
    }
}
