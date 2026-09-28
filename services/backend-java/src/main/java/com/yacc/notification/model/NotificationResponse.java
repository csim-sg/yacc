package com.yacc.notification.model;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Wire representation of a notification (frozen contract component
 * {@code Notification}; POC notifications-service shape).
 */
public record NotificationResponse(
        UUID id,
        String userId,
        String type,
        UUID conversationId,
        String actorId,
        String message,
        boolean isRead,
        JsonNode metadata,
        LocalDateTime createdAt) {

    /** JSON-boundary edge: the entity stores metadata as a JSON string. */
    public static NotificationResponse from(com.yacc.notification.model.Notification notification,
            com.fasterxml.jackson.databind.ObjectMapper mapper) {
        JsonNode metadata = null;
        if (notification.getMetadata() != null) {
            try {
                metadata = mapper.readTree(notification.getMetadata());
            } catch (java.io.IOException ignored) {
                metadata = null;
            }
        }
        return new NotificationResponse(
                notification.getId(),
                notification.getUserId(),
                notification.getType(),
                notification.getConversationId(),
                notification.getActorId(),
                notification.getMessage(),
                notification.isRead(),
                metadata,
                notification.getCreatedAt());
    }
}
