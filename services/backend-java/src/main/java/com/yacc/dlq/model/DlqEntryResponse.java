package com.yacc.dlq.model;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Wire representation of a DLQ entry (frozen contract component
 * {@code DlqEntry}; POC dead-letter row shape).
 */
public record DlqEntryResponse(
        UUID id,
        UUID messageId,
        UUID conversationId,
        String failureReason,
        Integer totalAttempts,
        String lastError,
        LocalDateTime movedAt,
        LocalDateTime expiresAt,
        Boolean retryAttempt,
        LocalDateTime retriedAt,
        UUID retriedBy) {

    public static DlqEntryResponse from(com.yacc.dlq.model.DeadLetterQueueEntry entry) {
        return new DlqEntryResponse(entry.getId(), entry.getMessageId(), entry.getConversationId(),
                entry.getFailureReason(), entry.getTotalAttempts(), entry.getLastError(),
                entry.getMovedAt(), entry.getExpiresAt(), entry.getRetryAttempt(),
                entry.getRetriedAt(), entry.getRetriedBy());
    }
}
