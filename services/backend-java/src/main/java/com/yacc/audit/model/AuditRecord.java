package com.yacc.audit.model;

import java.time.Instant;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Immutable audit record (SPEC-002 TR-07; ADR-029 audit re-expression).
 *
 * <p>Field parity with the POC audit contract ({@code audit_logs} in
 * {@code .docs/02-api-and-data-model.md}): {@code action}, {@code entityType},
 * {@code entityId}, {@code actorId}, {@code metadata}, {@code createdAt}.
 * {@code metadata} is {@link JsonNode} held at the documented JSON boundary
 * (guardrails 004 §3) and never leaks into domain types. The database table
 * itself is re-expressed by MIG-020/MIG-021.</p>
 *
 * @param action audit action name (e.g. the POC vocabulary "user.login.failed")
 * @param entityType audited entity type (e.g. "user")
 * @param entityId audited entity id (nullable when only an actor is known)
 * @param actorId acting principal id (nullable for anonymous failures)
 * @param metadata free-form JSON detail (nullable)
 * @param createdAt occurrence time (ISO-8601 when logged)
 */
public record AuditRecord(
        String action,
        String entityType,
        String entityId,
        String actorId,
        JsonNode metadata,
        Instant createdAt) {
}
