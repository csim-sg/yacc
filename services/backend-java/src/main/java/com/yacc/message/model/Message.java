package com.yacc.message.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * JPA entity for the {@code messages} table (MIG-021; V1 baseline, ADR-027).
 *
 * <p>{@code sender_id} is a plain typed FK column — user identity lives in
 * the {@code auth} bounded context (ADR-030); {@code sender_name} carries the
 * display name for external senders. Enum columns map through
 * {@link MessageStatusConverter} and {@link MessageDirectionConverter}.</p>
 */
@Entity
@Table(name = "messages")
public class Message {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "conversation_id", nullable = false, updatable = false)
    private UUID conversationId;

    @Column(name = "sender_id", updatable = false)
    private String senderId;

    @Column(name = "sender_name", nullable = false, length = 255)
    private String senderName;

    @Column(name = "body", nullable = false)
    private String body;

    @Convert(converter = MessageStatusConverter.class)
    @Column(name = "status", nullable = false)
    private MessageStatus status;

    @Convert(converter = MessageDirectionConverter.class)
    @Column(name = "direction", nullable = false, updatable = false)
    private MessageDirection direction;

    @Column(name = "external_message_id", length = 255)
    private String externalMessageId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata")
    private String metadata;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Message() {
        // JPA
    }

    public Message(UUID id, UUID conversationId, String senderId, String senderName,
                   String body, MessageDirection direction) {
        this.id = id == null ? UUID.randomUUID() : id;
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.senderName = senderName;
        this.body = body;
        this.direction = direction;
        this.status = MessageStatus.PENDING;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getConversationId() {
        return conversationId;
    }

    public String getSenderId() {
        return senderId;
    }

    public String getSenderName() {
        return senderName;
    }

    public String getBody() {
        return body;
    }

    public MessageStatus getStatus() {
        return status;
    }

    public MessageDirection getDirection() {
        return direction;
    }

    public String getExternalMessageId() {
        return externalMessageId;
    }

    public String getMetadata() {
        return metadata;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public void setStatus(MessageStatus status) {
        this.status = status;
    }

    public void setExternalMessageId(String externalMessageId) {
        this.externalMessageId = externalMessageId;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
