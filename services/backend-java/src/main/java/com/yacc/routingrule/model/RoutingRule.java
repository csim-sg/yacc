package com.yacc.routingrule.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * JPA entity for the {@code routing_rules} table (MIG-021; V1 baseline,
 * ADR-027). {@code status} stays a varchar column (not a PostgreSQL enum) and
 * {@code conditions}/{@code actions} are JSON documents (ADR-021 lenient
 * JSON), mapped as raw JSON strings — typed parsing belongs to feature
 * services, not the persistence mapping.
 */
@Entity
@Table(name = "routing_rules")
public class RoutingRule {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "description")
    private String description;

    @Column(name = "status", nullable = false, length = 50)
    private String status;

    @Column(name = "priority", nullable = false)
    private Integer priority;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "conditions", nullable = false)
    private String conditions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "actions", nullable = false)
    private String actions;

    @Column(name = "created_by_id", nullable = false, updatable = false)
    private String createdById;

    @Column(name = "last_run_at")
    private LocalDateTime lastRunAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected RoutingRule() {
        // JPA
    }

    public RoutingRule(UUID id, String name, String status, Integer priority,
                       String conditions, String actions, String createdById) {
        this.id = id == null ? UUID.randomUUID() : id;
        this.name = name;
        this.status = status;
        this.priority = priority;
        this.conditions = conditions;
        this.actions = actions;
        this.createdById = createdById;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getStatus() {
        return status;
    }

    public Integer getPriority() {
        return priority;
    }

    public String getConditions() {
        return conditions;
    }

    public String getActions() {
        return actions;
    }

    public String getCreatedById() {
        return createdById;
    }

    public LocalDateTime getLastRunAt() {
        return lastRunAt;
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

    public void setDescription(String description) {        this.description = description;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setPriority(Integer priority) {
        this.priority = priority;
    }

    public void setConditions(String conditions) {
        this.conditions = conditions;
    }

    public void setActions(String actions) {
        this.actions = actions;
    }

    public void setLastRunAt(LocalDateTime lastRunAt) {
        this.lastRunAt = lastRunAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
