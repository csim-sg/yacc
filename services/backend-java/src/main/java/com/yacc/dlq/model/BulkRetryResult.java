package com.yacc.dlq.model;

import java.util.List;

/**
 * Bulk-retry outcome.
 *
 * @param successful retried entries
 * @param failed     skipped entries
 * @param errors     per-id failure reasons
 */
public record BulkRetryResult(int successful, int failed, List<BulkRetryError> errors) {
}
