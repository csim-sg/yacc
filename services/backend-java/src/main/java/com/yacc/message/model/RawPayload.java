package com.yacc.message.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * JPA entity for the {@code raw_payloads} table (MIG-021; V1 baseline,
 * ADR-027) — connector raw payload retention (7-day default expiry).
 * {@code message_id} is a plain typed FK column (ADR-030).
 */
@Entity
@Table(name = "raw_payloads")
public class RawPayload {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Integer id;

    @Column(name = "message_id", nullable = false, updatable = false)
    private UUID messageId;

    @Column(name = "platform", nullable = false, length = 50)
    private String platform;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false)
    private String payload;

    @Column(name = "storage_key", length = 500)
    private String storageKey;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected RawPayload() {
        // JPA
    }

    public RawPayload(UUID messageId, String platform, String payload, LocalDateTime expiresAt) {
        this.messageId = messageId;
        this.platform = platform;
        this.payload = payload;
        this.expiresAt = expiresAt;
        this.createdAt = LocalDateTime.now();
    }

    public Integer getId() {
        return id;
    }

    public UUID getMessageId() {
        return messageId;
    }

    public String getPlatform() {
        return platform;
    }

    public String getPayload() {
        return payload;
    }

    public String getStorageKey() {
        return storageKey;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setStorageKey(String storageKey) {
        this.storageKey = storageKey;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }
}
