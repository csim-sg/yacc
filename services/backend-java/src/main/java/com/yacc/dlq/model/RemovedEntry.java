package com.yacc.dlq.model;

/**
 * Removed entry identity.
 *
 * @param id             DLQ entry id
 * @param messageId      message UUID
 * @param conversationId conversation UUID
 * @param failureReason  failure reason
 */
public record RemovedEntry(String id, String messageId, String conversationId,
        String failureReason) {
}
