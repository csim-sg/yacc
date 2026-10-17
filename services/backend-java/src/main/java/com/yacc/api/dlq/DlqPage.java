package com.yacc.api.dlq;

import com.yacc.entity.DeadLetterQueueEntry;
import java.util.List;

/**
 * One DLQ page.
 *
 * @param entries page items
 * @param total   matching entries
 * @param page    1-indexed page
 * @param limit   page size
 */
public record DlqPage(List<DeadLetterQueueEntry> entries, long total, int page, int limit) {
}
