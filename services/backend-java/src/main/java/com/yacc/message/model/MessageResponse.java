package com.yacc.message.model;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

import com.yacc.message.model.MessageStatus;
import com.yacc.message.model.MessageDirection;

/**
 * Wire representation of a message (frozen contract component
 * {@code Message}; POC {@code message.types MessageResponseDTO}).
 *
 * @param id message UUID
 * @param conversationId owning conversation UUID
 * @param senderId sender user UUID, null for external senders
 * @param senderName display name of the sender
 * @param body message body
 * @param status lowercase wire status (pending | sent | failed)
 * @param direction lowercase wire direction (inbound | outbound)
 * @param externalMessageId platform message id, when delivered
 * @param metadata JSON metadata object or null
 * @param createdAt creation timestamp
 * @param updatedAt last-update timestamp
 */
public record MessageResponse(
        UUID id,
        UUID conversationId,
        String senderId,
        String senderName,
        String body,
        String status,
        String direction,
        String externalMessageId,
        JsonNode metadata,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    /** JSON-boundary edge: the entity stores metadata as a JSON string. */
    public static MessageResponse from(com.yacc.message.model.Message message,
            com.fasterxml.jackson.databind.ObjectMapper mapper) {
        JsonNode metadata = null;
        if (message.getMetadata() != null) {
            try {
                metadata = mapper.readTree(message.getMetadata());
            } catch (java.io.IOException ignored) {
                metadata = null;
            }
        }
        return new MessageResponse(
                message.getId(),
                message.getConversationId(),
                message.getSenderId(),
                message.getSenderName(),
                message.getBody(),
                message.getStatus().getLabel(),
                message.getDirection().getLabel(),
                message.getExternalMessageId(),
                metadata,
                message.getCreatedAt(),
                message.getUpdatedAt());
    }
}
