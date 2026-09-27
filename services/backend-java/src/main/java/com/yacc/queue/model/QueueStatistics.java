package com.yacc.queue.model;

import java.time.LocalDateTime;

/**
 * Queue statistics payload (BullMQ vocabulary, contract op
 * {@code getQueueStats} + timestamp, POC parity).
 *
 * @param active    active jobs
 * @param waiting   waiting jobs
 * @param completed completed jobs
 * @param failed    failed jobs
 * @param delayed   delayed jobs
 * @param dlq       dead-lettered entries
 * @param totalJobs total jobs across states
 * @param timestamp payload timestamp
 */
public record QueueStatistics(long active, long waiting, long completed, long failed, long delayed,
        long dlq, long totalJobs, LocalDateTime timestamp) {
}
