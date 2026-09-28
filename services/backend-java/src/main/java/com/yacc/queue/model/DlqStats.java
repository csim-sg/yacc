package com.yacc.queue.model;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Queue-surface DLQ statistics (POC {@code messageQueueDLQService} key
 * parity: totalEntries/byFailureReason/oldestEntry/newestEntry).
 *
 * @param totalEntries     entry count
 * @param byFailureReason  counts keyed by failure reason
 * @param oldestEntry      earliest moved-at
 * @param newestEntry      latest moved-at
 */
public record DlqStats(long totalEntries, Map<String, Long> byFailureReason,
        LocalDateTime oldestEntry, LocalDateTime newestEntry) {
}
