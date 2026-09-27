package com.yacc.queue.model;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Queue DLQ page payload.
 *
 * @param entries   row projections
 * @param total     matching entries
 * @param page      1-indexed page
 * @param pageSize  page size
 * @param timestamp payload timestamp
 */
public record QueueDlqPage(List<QueueDlqEntryRow> entries, long total, int page, int pageSize,
        LocalDateTime timestamp) {
}
