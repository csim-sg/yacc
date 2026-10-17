package com.yacc.api.audit;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;

/**
 * Wire representation of an audit log (frozen contract component
 * {@code AuditLog}; POC {@code AuditLog.type} shape).
 */
public record AuditLogResponse(
        UUID id,
        String actorId,
        // Contract AuditLog.actorName: optional, non-nullable — omitted when
        // absent, never null (MIG-102). actorId stays required-nullable.
        @JsonInclude(JsonInclude.Include.NON_NULL) String actorName,
        String action,
        String entityType,
        String entityId,
        JsonNode metadata,
        // Contract AuditLog.ipAddress: optional, non-nullable — omitted when
        // absent, never null (MIG-102).
        @JsonInclude(JsonInclude.Include.NON_NULL) String ipAddress,
        LocalDateTime createdAt) {

    /** JSON-boundary edge: the entity stores metadata as a JSON string. */
    public static AuditLogResponse from(com.yacc.entity.AuditLog log,
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
