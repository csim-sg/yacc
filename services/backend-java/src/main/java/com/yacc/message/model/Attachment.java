package com.yacc.message.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code attachments} table (MIG-021; V1 baseline,
 * ADR-027). {@code message_id} is a plain typed FK column (ADR-030).
 */
@Entity
@Table(name = "attachments")
public class Attachment {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "message_id", nullable = false, updatable = false)
    private UUID messageId;

    @Column(name = "name", nullable = false, length = 500)
    private String name;

    @Column(name = "mime_type", nullable = false, length = 100)
    private String mimeType;

    @Column(name = "size", nullable = false)
    private Integer size;

    @Column(name = "storage_key", nullable = false, length = 500)
    private String storageKey;

    @Column(name = "url", nullable = false)
    private String url;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected Attachment() {
        // JPA
    }

    public Attachment(UUID id, UUID messageId, String name, String mimeType,
                      Integer size, String storageKey, String url) {
        this.id = id == null ? UUID.randomUUID() : id;
        this.messageId = messageId;
        this.name = name;
        this.mimeType = mimeType;
        this.size = size;
        this.storageKey = storageKey;
        this.url = url;
        this.createdAt = LocalDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getMessageId() {
        return messageId;
    }

    public String getName() {
        return name;
    }

    public String getMimeType() {
        return mimeType;
    }

    public Integer getSize() {
        return size;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public String getUrl() {
        return url;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setUrl(String url) {
        this.url = url;
    }
}
