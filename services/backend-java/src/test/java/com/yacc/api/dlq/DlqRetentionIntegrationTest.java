package com.yacc.api.dlq;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.springframework.beans.factory.annotation.Autowired;

import com.yacc.common.testsupport.AbstractPostgresIntegrationTest;
import com.yacc.entity.DeadLetterQueueEntry;
import com.yacc.service.DlqService;

/**
 * MIG-063 DLQ 7-day retention enforcement over the real Testcontainers
 * PostgreSQL data layer (review finding on PR #420): the expiry timestamp
 * every {@code enqueue} writes is actually swept — expired entries are
 * removed in bounded, independently committed batches, unexpired entries
 * (including the not-yet-reached 7-day boundary) are preserved, and the
 * Quartz-owned sweep registration is idempotent. Deterministic: the sweep
 * is driven synchronously, no scheduler startup and no wall-clock waits
 * (Quartz auto-startup stays off in tests, so the registered sweep never
 * fires in the background here).
 */
class DlqRetentionIntegrationTest extends AbstractPostgresIntegrationTest {

    @Autowired
    private DlqService dlq;
    @Autowired
    private DlqRetentionSchedule retentionSchedule;
    @Autowired
    private Scheduler scheduler;
    @Autowired
    private com.yacc.repository.DeadLetterQueueEntryRepository dlqEntries;
    @Autowired
    private com.yacc.repository.ConversationRepository conversations;
    @Autowired
    private com.yacc.repository.MessageRepository messages;

    @AfterEach
    void cleanCommittedState() {
        dlqEntries.deleteAll();
        messages.deleteAll();
        conversations.deleteAll();
    }

    @Test
    void expiredEntriesAreRemovedInBoundedBatchesAndUnexpiredEntriesArePreserved() {
        List<UUID> keptIds = new ArrayList<>();
        seedExpired(205);
        keptIds.add(seedKept(LocalDateTime.now().plusDays(6)));   // inside the 7-day window
        keptIds.add(seedKept(LocalDateTime.now().plusSeconds(30))); // not yet expired
        keptIds.add(seedKeptByEnqueue());                          // the enqueue 7-day default

        int batch = dlq.removeExpiredBatch();
        assertThat(batch).isEqualTo(200); // the bounded batch size
        assertThat(dlqEntries.count()).isEqualTo(8); // 5 expired remain + 3 kept

        assertThat(dlq.removeExpiredBatch()).isEqualTo(5);
        assertThat(dlq.removeExpiredBatch()).isZero();

        assertThat(dlqEntries.findAll())
                .extracting(DeadLetterQueueEntry::getId)
                .containsExactlyInAnyOrderElementsOf(keptIds);
    }

    @Test
    void removeExpiredEntriesSweepsAllExpiredRowsWithinItsBound() {
        List<UUID> keptIds = new ArrayList<>();
        seedExpired(205);
        keptIds.add(seedKept(LocalDateTime.now().plusDays(7)));
        keptIds.add(seedKept(LocalDateTime.now().plusHours(1)));

        assertThat(dlq.removeExpiredEntries()).isEqualTo(205);

        assertThat(dlqEntries.findAll())
                .extracting(DeadLetterQueueEntry::getId)
                .containsExactlyInAnyOrderElementsOf(keptIds);
    }

    @Test
    void retentionSweepRegistrationIsIdempotentQuartzOwnedAndHourly()
            throws SchedulerException {
        // Deterministic fresh registration (the durable job may survive in
        // the shared store from an earlier boot).
        JobKey sweepKey = JobKey.jobKey(DlqRetentionSchedule.SWEEP_NAME,
                DlqRetentionSchedule.SWEEP_GROUP);
        scheduler.deleteJob(sweepKey);
        assertThat(scheduler.checkExists(sweepKey)).isFalse();

        retentionSchedule.register();

        assertThat(scheduler.checkExists(sweepKey)).isTrue();
        var triggers = scheduler.getTriggersOfJob(sweepKey);
        assertThat(triggers).hasSize(1);
        assertThat(((org.quartz.SimpleTrigger) triggers.getFirst()).getRepeatInterval())
                .isEqualTo(3_600_000L);

        // Re-registration (a restart) never double-schedules.
        retentionSchedule.register();
        assertThat(scheduler.getTriggersOfJob(sweepKey)).hasSize(1);
    }

    private void seedExpired(int count) {
        LocalDateTime expired = LocalDateTime.now().minusHours(1);
        for (int i = 0; i < count; i++) {
            seedEntry(UUID.randomUUID(), expired);
        }
    }

    private UUID seedKept(LocalDateTime expiresAt) {
        return seedEntry(UUID.randomUUID(), expiresAt).getId();
    }

    /** An entry through the production enqueue surface (7-day expiry). */
    private UUID seedKeptByEnqueue() {
        UUID messageId = UUID.randomUUID();
        var conversation = conversations.save(new com.yacc.entity.Conversation(
                UUID.randomUUID(), com.yacc.entity.ChannelType.IRC, "#retention"));
        var message = messages.save(new com.yacc.entity.Message(messageId,
                conversation.getId(), null, "yacc", "body",
                com.yacc.entity.MessageDirection.OUTBOUND));
        message.setStatus(com.yacc.entity.MessageStatus.FAILED);
        messages.save(message);
        return dlq.enqueue(messageId, conversation.getId(),
                "{\"origin\":\"dlq-retention-test\"}", "platform_error", 1,
                "initial failure", null, null).getId();
    }

    private DeadLetterQueueEntry seedEntry(UUID messageId, LocalDateTime expiresAt) {
        var conversation = conversations.save(new com.yacc.entity.Conversation(
                UUID.randomUUID(), com.yacc.entity.ChannelType.IRC, "#retention"));
        var message = messages.save(new com.yacc.entity.Message(messageId,
                conversation.getId(), null, "yacc", "body",
                com.yacc.entity.MessageDirection.OUTBOUND));
        message.setStatus(com.yacc.entity.MessageStatus.FAILED);
        messages.save(message);
        return dlqEntries.save(new DeadLetterQueueEntry(null, messageId,
                conversation.getId(), "{\"origin\":\"dlq-retention-test\"}",
                "platform_error", 1, "initial failure", expiresAt));
    }
}
