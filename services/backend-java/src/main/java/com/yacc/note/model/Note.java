package com.yacc.note.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code notes} table (MIG-021; V1 baseline, ADR-027).
 * FK columns (conversation_id, author_id) are plain typed columns (ADR-030).
 */
@Entity
@Table(name = "notes")
public class Note {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "conversation_id", nullable = false, updatable = false)
    private UUID conversationId;

    @Column(name = "author_id", nullable = false, updatable = false)
    private String authorId;

    @Column(name = "body", nullable = false)
    private String body;

    @Column(name = "mentions")
    private String mentions;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Note() {
        // JPA
    }

    public Note(UUID id, UUID conversationId, String authorId, String body) {
        this.id = id == null ? UUID.randomUUID() : id;
        this.conversationId = conversationId;
        this.authorId = authorId;
        this.body = body;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getConversationId() {
        return conversationId;
    }

    public String getAuthorId() {
        return authorId;
    }

    public String getBody() {
        return body;
    }

    public String getMentions() {
        return mentions;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public void setMentions(String mentions) {
        this.mentions = mentions;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
