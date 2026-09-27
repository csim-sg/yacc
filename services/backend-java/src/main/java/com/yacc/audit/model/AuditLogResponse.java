package com.yacc.audit.model;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Wire representation of an audit log (frozen contract component
 * {@code AuditLog}; POC {@code AuditLog.type} shape).
 */
public record AuditLogResponse(
        UUID id,
        String actorId,
        String actorName,
        String action,
        String entityType,
        String entityId,
        JsonNode metadata,
        String ipAddress,
        LocalDateTime createdAt) {

    /** JSON-boundary edge: the entity stores metadata as a JSON string. */
    public static AuditLogResponse from(com.yacc.audit.model.AuditLog log,
            String actorName,
            com.fasterxml.jackson.databind.ObjectMapper mapper) {
        JsonNode metadata = null;
        if (log.getMetadata() != null) {
            try {
                metadata = mapper.readTree(log.getMetadata());
            } catch (java.io.IOException ignored) {
                metadata = null;
            }
        }
        return new AuditLogResponse(
                log.getId(),
                log.getActorId(),
                actorName,
                log.getAction(),
                log.getEntityType(),
                log.getEntityId() == null ? null : log.getEntityId().toString(),
                metadata,
                log.getIpAddress(),
                log.getCreatedAt());
    }
}
