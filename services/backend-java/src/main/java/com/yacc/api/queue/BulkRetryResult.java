package com.yacc.api.queue;

import java.time.LocalDateTime;
import java.util.List;

import com.yacc.api.dlq.BulkRetryError;

/**
 * Bulk-retry outcome.
 *
 * @param successful retried entries
 * @param failed     skipped entries
 * @param errors     per-id failure reasons
 * @param timestamp  payload timestamp
 */
public record BulkRetryResult(int successful, int failed,
        List<BulkRetryError> errors, LocalDateTime timestamp) {
}
