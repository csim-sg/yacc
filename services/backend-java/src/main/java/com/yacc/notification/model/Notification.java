package com.yacc.notification.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * JPA entity for the {@code notifications} table (MIG-021; V1 baseline,
 * ADR-027). FK columns (user_id, conversation_id, actor_id) are plain typed
 * columns (ADR-030); {@code type} is a varchar discriminator.
 */
@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private String userId;

    @Column(name = "type", nullable = false, updatable = false, length = 50)
    private String type;

    @Column(name = "conversation_id", updatable = false)
    private UUID conversationId;

    @Column(name = "actor_id", updatable = false)
    private String actorId;

    @Column(name = "message", nullable = false)
    private String message;

    @Column(name = "is_read", nullable = false)
    private boolean isRead;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata")
    private String metadata;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected Notification() {
        // JPA
    }

    public Notification(UUID id, String userId, String type, UUID conversationId,
                        String actorId, String message) {
        this.id = id == null ? UUID.randomUUID() : id;
        this.userId = userId;
        this.type = type;
        this.conversationId = conversationId;
        this.actorId = actorId;
        this.message = message;
        this.isRead = false;
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getType() {
        return type;
    }

    public UUID getConversationId() {
        return conversationId;
    }

    public String getActorId() {
        return actorId;
    }

    public String getMessage() {
        return message;
    }

    public boolean isRead() {
        return isRead;
    }

    public String getMetadata() {
        return metadata;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public void setRead(boolean read) {
        isRead = read;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }
}
