package com.yacc.audit.model;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Typed JSON-export row (frozen contract component {@code AuditLog};
 * ledger row REST-AUDITLOG-003 export). {@code metadata} is held as a
 * {@link JsonNode} at the documented JSON boundary (guardrails 004 §3) —
 * the contract types it as an arbitrary object.
 *
 * @param id         audit entry id
 * @param actorId    acting principal id (nullable)
 * @param action     audit action
 * @param entityType audited entity type
 * @param entityId   audited entity id (string form, nullable)
 * @param metadata   arbitrary JSON detail (contract: object)
 * @param createdAt  occurrence time
 */
public record AuditExportRow(
        UUID id,
        String actorId,
        String action,
        String entityType,
        String entityId,
        JsonNode metadata,
        LocalDateTime createdAt) {
}
