package com.yacc.queue.model;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Typed queue-surface DLQ row projection (POC key parity: messageId,
 * conversationId, failedAt, failureReason, totalAttempts, lastError).
 *
 * @param messageId      originating message
 * @param conversationId originating conversation
 * @param failedAt       when the entry was moved to the DLQ
 * @param failureReason  failure reason label
 * @param totalAttempts  delivery attempts before dead-lettering
 * @param lastError      last delivery error
 */
public record QueueDlqEntryRow(UUID messageId, UUID conversationId, LocalDateTime failedAt,
        String failureReason, Integer totalAttempts, String lastError) {
}
