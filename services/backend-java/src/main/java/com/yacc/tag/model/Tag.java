package com.yacc.tag.model;

import java.time.LocalDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code tags} table (MIG-021; V1 baseline, ADR-027).
 * {@code created_by_id} is a plain typed FK column (ADR-030).
 */
@Entity
@Table(name = "tags")
public class Tag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Integer id;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "color", nullable = false, length = 7)
    private String color;

    @Column(name = "created_by_id", nullable = false, updatable = false)
    private String createdById;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected Tag() {
        // JPA
    }

    public Tag(String name, String color, String createdById) {
        this.name = name;
        this.color = color;
        this.createdById = createdById;
        this.createdAt = LocalDateTime.now();
    }

    public Integer getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getColor() {
        return color;
    }

    public String getCreatedById() {
        return createdById;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setColor(String color) {
        this.color = color;
    }
}
