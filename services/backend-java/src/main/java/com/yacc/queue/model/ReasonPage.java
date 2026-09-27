package com.yacc.queue.model;

import java.time.LocalDateTime;
import java.util.List;

/**
 * By-reason payload.
 *
 * @param failureReason queried reason
 * @param count         entries
 * @param entries       row projections
 * @param timestamp     payload timestamp
 */
public record ReasonPage(String failureReason, int count, List<QueueDlqEntryRow> entries,
        LocalDateTime timestamp) {
}
