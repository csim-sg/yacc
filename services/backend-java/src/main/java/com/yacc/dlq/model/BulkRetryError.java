package com.yacc.dlq.model;

/**
 * One bulk-retry failure.
 *
 * @param messageId failed message
 * @param error     safe reason
 */
public record BulkRetryError(String messageId, String error) {
}
