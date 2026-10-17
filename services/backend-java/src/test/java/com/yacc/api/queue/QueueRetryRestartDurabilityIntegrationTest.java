package com.yacc.api.queue;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.fail;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.Properties;
import java.util.UUID;
import java.util.function.BooleanSupplier;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.impl.StdSchedulerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
import com.yacc.entity.DeadLetterQueueEntry;
import com.yacc.repository.DeadLetterQueueEntryRepository;
import com.yacc.service.DlqService;

/**
 * MIG-063 restart durability over the JDBC job store (AC-MIG-063-1; ADR-028
 * "DB-backed"): a scheduled cycle persists in the PostgreSQL qrtz_* tables
 * and a <b>fresh scheduler instance</b> opening the SAME store sees it and
 * drives it — the simulated-restart proof that nothing lives only in RAM.
 * The boot scheduler stands by (single-writer posture preserved while the
 * replacement instance runs) and resumes afterwards.
 *
 * <p>The policy stays at the frozen production ladder (60s first step) so
 * the pending cycle cannot fire mid-dance; waits are bounded condition
 * polls, never fixed sleeps.</p>
 */
@TestPropertySource(properties = {
        "spring.quartz.auto-startup=true",
        "yacc.queue.retry.backoff-delays-ms=60000,300000,1800000",
        "yacc.queue.retry.marker-poll-interval-ms=3600000"
})
class QueueRetryRestartDurabilityIntegrationTest extends AbstractPostgresIntegrationTest {

    private static final UUID ACTOR = UUID.fromString(
            "00000000-0000-0000-0000-00000000d1b0");
    private static final Duration ATTEMPT_TIMEOUT = Duration.ofSeconds(15);

    @Autowired
    private Scheduler scheduler;
    @Autowired
    private QueueRetryService queueRetry;
    @Autowired
    private DlqService dlq;
    @Autowired
    private DeadLetterQueueEntryRepository dlqEntries;
    @Autowired
    private com.yacc.repository.ConversationRepository conversations;
    @Autowired
    private com.yacc.repository.MessageRepository messages;
    @Autowired
    private javax.sql.DataSource dataSource;
    @MockitoBean
    private RetryDeliveryHandler handler;

    @AfterEach
    void cleanCommittedState() throws SchedulerException {
        // Resume the boot scheduler if the dance left it standing by, then
        // self-clean the committed rows (MIG-101 committed-writers rule).
        if (scheduler.isInStandbyMode()) {
            scheduler.start();
        }
        scheduler.clear();
        dlqEntries.deleteAll();
        messages.deleteAll();
        conversations.deleteAll();
    }

    @Test
    void scheduledCycleSurvivesASchedulerRestartOverTheSamePostgresStore()
            throws SchedulerException {
        UUID messageId = UUID.randomUUID();
        var conversation = conversations.save(new com.yacc.entity.Conversation(UUID.randomUUID(),
                com.yacc.entity.ChannelType.IRC, "#retry-restart"));
        var message = messages.save(new com.yacc.entity.Message(messageId, conversation.getId(),
                null, "yacc", "body", com.yacc.entity.MessageDirection.OUTBOUND));
        message.setStatus(com.yacc.entity.MessageStatus.FAILED);
        messages.save(message);
        DeadLetterQueueEntry entry = dlq.enqueue(messageId, conversation.getId(),
                "{\"origin\":\"mig-063-restart-test\"}", "platform_error", 1, "initial failure",
                null, null);
        dlq.markRetried(entry.getId(), ACTOR);
        queueRetry.scheduleCycle(messageId);

        JobKey key = QueueRetryService.jobKey(messageId);
        assertThat(scheduler.checkExists(key)).isTrue();

        when(handler.deliver(messageId))
                .thenReturn(RetryDeliveryHandler.RetryOutcome.failure("node replaced under us"));

        // Simulated restart: the in-process scheduler steps aside and a
        // fresh Quartz instance opens the SAME PostgreSQL job store (same
        // scheduler name = same store partition; different instance id).
        scheduler.standby();
        Scheduler restarted = null;
        try {
            restarted = freshSchedulerOverTheSameStore();
            // The job factory must be installed before start(); the lambda
            // constructs the constructor-injected job with the context's
            // worker service (same wiring the boot scheduler uses).
            restarted.setJobFactory((bundle, schedulerContext) -> new RetryJob(queueRetry));
            restarted.start();

            assertThat(restarted.checkExists(key)).isTrue();

            // The restarted instance drives the persisted cycle: attempt 1
            // executes through the worker seam and the next attempt is
            // re-scheduled from the persisted state.
            restarted.triggerJob(key);

            await(ATTEMPT_TIMEOUT, () -> dlq.findByMessageId(messageId)
                    .map(reloaded -> dlq.retryCycleAttempt(reloaded) >= 1)
                    .orElse(false));
            verify(handler, Mockito.timeout(5000)).deliver(messageId);
        } finally {
            if (restarted != null) {
                restarted.shutdown(true);
            }
            scheduler.start();
        }

        DeadLetterQueueEntry reloaded = dlq.findByMessageId(messageId).orElseThrow();
        assertThat(dlq.retryCycleAttempt(reloaded)).isEqualTo(1);
        assertThat(reloaded.getTotalAttempts()).isEqualTo(2); // 1 seed + 1 redelivery attempt
        assertThat(reloaded.getLastError()).isEqualTo("node replaced under us");
        assertThat(scheduler.checkExists(key)).isTrue(); // next attempt pending on the ladder
    }

    /**
     * A fresh, non-Spring Quartz instance over the same PostgreSQL store —
     * the standalone-restart envelope (PostgreSQLDelegate + JobStoreTX,
     * same scheduler name, its own instance id). The store's datasource is
     * the test's Hikari pool via a custom ConnectionProvider (Quartz's
     * bundled C3p0 provider is deliberately not added — no new dependency).
     */
    private Scheduler freshSchedulerOverTheSameStore() throws SchedulerException {
        SharedDataSourceConnectionProvider.shared = dataSource;
        Properties props = new Properties();
        // Same scheduler NAME = same store partition (SCHED_NAME); only the
        // instance id differs — the replacement-instance posture.
        props.setProperty(StdSchedulerFactory.PROP_SCHED_INSTANCE_NAME, "yacc-backend");
        props.setProperty(StdSchedulerFactory.PROP_SCHED_INSTANCE_ID, "restarted-test-instance");
        props.setProperty(StdSchedulerFactory.PROP_JOB_STORE_CLASS,
                "org.quartz.impl.jdbcjobstore.JobStoreTX");
        props.setProperty("org.quartz.jobStore.driverDelegateClass",
                "org.quartz.impl.jdbcjobstore.PostgreSQLDelegate");
        props.setProperty("org.quartz.jobStore.dataSource", "recovery");
        props.setProperty("org.quartz.dataSource.recovery.connectionProvider.class",
                SharedDataSourceConnectionProvider.class.getName());
        props.setProperty("org.quartz.threadPool.class", "org.quartz.simpl.SimpleThreadPool");
        props.setProperty("org.quartz.threadPool.threadCount", "2");

        StdSchedulerFactory factory = new StdSchedulerFactory();
        factory.initialize(props);
        return factory.getScheduler();
    }

    /**
     * ConnectionProvider over the Spring-managed pool (set per test) — the
     * restarted instance shares the container's connections without adding
     * a pooling dependency to the build.
     */
    public static class SharedDataSourceConnectionProvider
            implements org.quartz.utils.ConnectionProvider {

        static volatile javax.sql.DataSource shared;

        @Override
        public java.sql.Connection getConnection() throws java.sql.SQLException {
            return shared.getConnection();
        }

        @Override
        public void initialize() {
            // nothing to prepare — the pool is managed by Spring
        }

        @Override
        public void shutdown() {
            // the pool is closed by Spring
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
