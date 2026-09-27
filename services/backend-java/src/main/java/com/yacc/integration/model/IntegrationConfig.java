package com.yacc.integration.model;

import java.time.LocalDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code integration_configs} table (MIG-021; V1 baseline,
 * ADR-027) — the platform IRC config row. {@code password_encrypted} holds
 * AES-256-GCM ciphertext produced by the integration encryption service
 * (ADR-027; never POC-format).
 */
@Entity
@Table(name = "integration_configs")
public class IntegrationConfig {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Integer id;

    @Column(name = "platform", nullable = false, length = 50)
    private String platform;

    @Column(name = "server", nullable = false, length = 255)
    private String server;

    @Column(name = "port", nullable = false)
    private Integer port;

    @Column(name = "username", nullable = false, length = 255)
    private String username;

    @Column(name = "password_encrypted")
    private String passwordEncrypted;

    @Column(name = "has_password", nullable = false)
    private boolean hasPassword;

    @Column(name = "password_updated_at")
    private LocalDateTime passwordUpdatedAt;

    @Column(name = "channels", nullable = false)
    private String channels;

    @Column(name = "updated_by_id")
    private String updatedById;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected IntegrationConfig() {
        // JPA
    }

    public IntegrationConfig(String platform, String server, Integer port,
                             String username, String channels) {
        this.platform = platform;
        this.server = server;
        this.port = port;
        this.username = username;
        this.channels = channels;
        this.hasPassword = false;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public Integer getId() {
        return id;
    }

    public String getPlatform() {
        return platform;
    }

    public String getServer() {
        return server;
    }

    public Integer getPort() {
        return port;
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordEncrypted() {
        return passwordEncrypted;
    }

    public boolean isHasPassword() {
        return hasPassword;
    }

    public LocalDateTime getPasswordUpdatedAt() {
        return passwordUpdatedAt;
    }

    public String getChannels() {
        return channels;
    }

    public String getUpdatedById() {
        return updatedById;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setServer(String server) {
        this.server = server;
    }

    public void setPort(Integer port) {
        this.port = port;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public void setPasswordEncrypted(String passwordEncrypted) {
        this.passwordEncrypted = passwordEncrypted;
    }

    public void setHasPassword(boolean hasPassword) {
        this.hasPassword = hasPassword;
    }

    public void setPasswordUpdatedAt(LocalDateTime passwordUpdatedAt) {
        this.passwordUpdatedAt = passwordUpdatedAt;
    }

    public void setChannels(String channels) {
        this.channels = channels;
    }

    public void setUpdatedById(String updatedById) {
        this.updatedById = updatedById;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
