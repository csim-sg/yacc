package com.yacc.auth.model;

import java.time.LocalDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code session} table (MIG-021; V1 baseline, ADR-027).
 */
@Entity
@Table(name = "session")
public class Session {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private String userId;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "token", nullable = false)
    private String token;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent")
    private String userAgent;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Session() {
        // JPA
    }

    public Session(String id, String userId, LocalDateTime expiresAt, String token) {
        this.id = id;
        this.userId = userId;
        this.expiresAt = expiresAt;
        this.token = token;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public String getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public String getToken() {
        return token;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
