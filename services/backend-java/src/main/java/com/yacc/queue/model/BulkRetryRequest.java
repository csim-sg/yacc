package com.yacc.queue.model;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/**
 * Bulk-retry body (frozen contract op {@code bulkRetryDlq}).
 *
 * @param messageIds target messages (POC cap 100)
 */
public record BulkRetryRequest(
        @NotEmpty @Size(max = 100) List<UUID> messageIds) {
}
