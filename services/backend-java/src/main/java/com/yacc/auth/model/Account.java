package com.yacc.auth.model;

import java.time.LocalDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code account} table (MIG-021; V1 baseline, ADR-027) —
 * external provider accounts linked to a user (POC BetterAuth shape).
 */
@Entity
@Table(name = "account")
public class Account {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private String userId;

    @Column(name = "account_id", nullable = false)
    private String accountId;

    @Column(name = "provider_id", nullable = false)
    private String providerId;

    @Column(name = "access_token")
    private String accessToken;

    @Column(name = "refresh_token")
    private String refreshToken;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Account() {
        // JPA
    }

    public Account(String id, String userId, String accountId, String providerId) {
        this.id = id;
        this.userId = userId;
        this.accountId = accountId;
        this.providerId = providerId;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public String getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getAccountId() {
        return accountId;
    }

    public String getProviderId() {
        return providerId;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
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

    public void setAccountId(String accountId) {
        this.accountId = accountId;
    }

    public void setProviderId(String providerId) {
        this.providerId = providerId;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
