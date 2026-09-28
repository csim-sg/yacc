package com.yacc.queue.model;

import java.time.LocalDateTime;

/**
 * DLQ stats + analysis payload (contract op {@code getQueueDlqStats});
 * the stats block carries the POC {@code totalEntries} key names.
 *
 * @param stats     DLQ statistics block
 * @param analysis  failure-pattern analysis
 * @param timestamp payload timestamp
 */
public record DlqStatsPayload(DlqStats stats, PatternAnalysis analysis,
        LocalDateTime timestamp) {
}
