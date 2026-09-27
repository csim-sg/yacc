package com.yacc.conversation.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code conversations} table (MIG-021; V1 baseline,
 * ADR-027). UUID primary keys are generated client-side — the database
 * {@code gen_random_uuid()} default stays authoritative for non-JPA writes.
 *
 * <p>FK columns (assigned_user_id, irc_profile_id) are plain typed columns:
 * entity relations never cross feature-package bounded contexts (ADR-030).</p>
 */
@Entity
@Table(name = "conversations")
public class Conversation {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Convert(converter = ChannelTypeConverter.class)
    @Column(name = "channel", nullable = false, updatable = false)
    private ChannelType channel;

    @Column(name = "external_thread_id", nullable = false, updatable = false, length = 255)
    private String externalThreadId;

    @Column(name = "irc_profile_id")
    private Integer ircProfileId;

    @Column(name = "title", length = 500)
    private String title;

    @Convert(converter = ConversationStatusConverter.class)
    @Column(name = "status", nullable = false)
    private ConversationStatus status;

    @Convert(converter = ConversationPriorityConverter.class)
    @Column(name = "priority", nullable = false)
    private ConversationPriority priority;

    @Column(name = "assigned_user_id")
    private String assignedUserId;

    @Column(name = "metadata")
    private String metadata;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "last_activity_at", nullable = false)
    private LocalDateTime lastActivityAt;

    protected Conversation() {
        // JPA
    }

    public Conversation(UUID id, ChannelType channel, String externalThreadId) {
        this.id = id == null ? UUID.randomUUID() : id;
        this.channel = channel;
        this.externalThreadId = externalThreadId;
        this.status = ConversationStatus.OPEN;
        this.priority = ConversationPriority.NORMAL;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
        this.lastActivityAt = this.createdAt;
    }

    public UUID getId() {
        return id;
    }

    public ChannelType getChannel() {
        return channel;
    }

    public String getExternalThreadId() {
        return externalThreadId;
    }

    public Integer getIrcProfileId() {
        return ircProfileId;
    }

    public String getTitle() {
        return title;
    }

    public ConversationStatus getStatus() {
        return status;
    }

    public ConversationPriority getPriority() {
        return priority;
    }

    public String getAssignedUserId() {
        return assignedUserId;
    }

    public String getMetadata() {
        return metadata;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public LocalDateTime getLastActivityAt() {
        return lastActivityAt;
    }

    public void setIrcProfileId(Integer ircProfileId) {
        this.ircProfileId = ircProfileId;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public void setStatus(ConversationStatus status) {
        this.status = status;
    }

    public void setPriority(ConversationPriority priority) {
        this.priority = priority;
    }

    public void setAssignedUserId(String assignedUserId) {
        this.assignedUserId = assignedUserId;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public void setLastActivityAt(LocalDateTime lastActivityAt) {
        this.lastActivityAt = lastActivityAt;
    }
}
