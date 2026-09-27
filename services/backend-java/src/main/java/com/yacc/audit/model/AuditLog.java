package com.yacc.audit.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code audit_logs} table (MIG-021; V1 baseline,
 * ADR-027). {@code entity_id} is polymorphic (uuid, no FK in the schema);
 * {@code actor_id} is a plain typed column (ADR-030).
 */
@Entity
@Table(name = "audit_logs")
public class AuditLog {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "actor_id", updatable = false)
    private String actorId;

    @Column(name = "action", nullable = false, updatable = false, length = 255)
    private String action;

    @Column(name = "entity_type", nullable = false, updatable = false, length = 50)
    private String entityType;

    @Column(name = "entity_id", nullable = false, updatable = false)
    private UUID entityId;

    @Column(name = "metadata")
    private String metadata;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected AuditLog() {
        // JPA
    }

    public AuditLog(UUID id, String actorId, String action, String entityType,
                    UUID entityId, String ipAddress) {
        this.id = id == null ? UUID.randomUUID() : id;
        this.actorId = actorId;
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
        this.ipAddress = ipAddress;
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public String getActorId() {
        return actorId;
    }

    public String getAction() {
        return action;
    }

    public String getEntityType() {
        return entityType;
    }

    public UUID getEntityId() {
        return entityId;
    }

    public String getMetadata() {
        return metadata;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }
}
