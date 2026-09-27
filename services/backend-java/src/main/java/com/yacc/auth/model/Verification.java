package com.yacc.auth.model;

import java.time.LocalDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code verification} table (MIG-021; V1 baseline,
 * ADR-027) — verification challenges (email verification et al.).
 */
@Entity
@Table(name = "verification")
public class Verification {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "identifier", nullable = false)
    private String identifier;

    @Column(name = "value", nullable = false)
    private String value;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Verification() {
        // JPA
    }

    public Verification(String id, String identifier, String value, LocalDateTime expiresAt) {
        this.id = id;
        this.identifier = identifier;
        this.value = value;
        this.expiresAt = expiresAt;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public String getId() {
        return id;
    }

    public String getIdentifier() {
        return identifier;
    }

    public String getValue() {
        return value;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setIdentifier(String identifier) {
        this.identifier = identifier;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
