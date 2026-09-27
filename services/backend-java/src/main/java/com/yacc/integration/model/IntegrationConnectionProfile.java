package com.yacc.integration.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code integration_connection_profiles} table (MIG-021;
 * V1 baseline, ADR-027). {@code encrypted_credentials} holds AES-256-GCM
 * ciphertext (ADR-027); {@code config} is the profile JSON document. FK
 * columns (created_by_id, updated_by_id) are plain typed columns (ADR-030).
 */
@Entity
@Table(name = "integration_connection_profiles")
public class IntegrationConnectionProfile {

    /** Single-tenant default from the V1 baseline column default. */
    public static final UUID DEFAULT_TENANT_ID =
            UUID.fromString("00000000-0000-0000-0000-000000000000");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Integer id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "integration_type", nullable = false, updatable = false, length = 50)
    private String integrationType;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "is_enabled", nullable = false)
    private boolean isEnabled;

    @Column(name = "is_active", nullable = false)
    private boolean isActive;

    @Column(name = "encrypted_credentials", nullable = false)
    private String encryptedCredentials;

    @Column(name = "config", nullable = false)
    private String config;

    @Column(name = "created_by_id")
    private String createdById;

    @Column(name = "updated_by_id")
    private String updatedById;

    @Column(name = "last_tested_at")
    private LocalDateTime lastTestedAt;

    @Column(name = "last_test_passed")
    private Boolean lastTestPassed;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected IntegrationConnectionProfile() {
        // JPA
    }

    public IntegrationConnectionProfile(String integrationType, String name,
                                        String encryptedCredentials, String config) {
        this.tenantId = DEFAULT_TENANT_ID;
        this.integrationType = integrationType;
        this.name = name;
        this.isEnabled = true;
        this.isActive = false;
        this.encryptedCredentials = encryptedCredentials;
        this.config = config;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public Integer getId() {
        return id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public String getIntegrationType() {
        return integrationType;
    }

    public String getName() {
        return name;
    }

    public boolean isEnabled() {
        return isEnabled;
    }

    public boolean isActive() {
        return isActive;
    }

    public String getEncryptedCredentials() {
        return encryptedCredentials;
    }

    public String getConfig() {
        return config;
    }

    public String getCreatedById() {
        return createdById;
    }

    public String getUpdatedById() {
        return updatedById;
    }

    public LocalDateTime getLastTestedAt() {
        return lastTestedAt;
    }

    public Boolean getLastTestPassed() {
        return lastTestPassed;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setEnabled(boolean enabled) {
        isEnabled = enabled;
    }

    public void setActive(boolean active) {
        // Schema CHECK icp_active_implies_enabled: active profiles are enabled.
        this.isActive = active;
        if (active) {
            this.isEnabled = true;
        }
    }

    public void setEncryptedCredentials(String encryptedCredentials) {
        this.encryptedCredentials = encryptedCredentials;
    }

    public void setConfig(String config) {
        this.config = config;
    }

    public void setCreatedById(String createdById) {
        this.createdById = createdById;
    }

    public void setUpdatedById(String updatedById) {
        this.updatedById = updatedById;
    }

    public void setLastTestedAt(LocalDateTime lastTestedAt) {
        this.lastTestedAt = lastTestedAt;
    }

    public void setLastTestPassed(Boolean lastTestPassed) {
        this.lastTestPassed = lastTestPassed;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
