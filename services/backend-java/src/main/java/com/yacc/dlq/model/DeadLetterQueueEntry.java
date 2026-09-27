package com.yacc.dlq.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code dead_letter_queue} table (MIG-021; V1 baseline +
 * applied 0006 tracing columns, ADR-027). FK columns (message_id,
 * conversation_id, irc_profile_id, retried_by) are plain typed columns
 * (ADR-030); JSON columns map as raw JSON strings.
 */
@Entity
@Table(name = "dead_letter_queue")
public class DeadLetterQueueEntry {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "message_id", nullable = false, updatable = false)
    private UUID messageId;

    @Column(name = "conversation_id", nullable = false, updatable = false)
    private UUID conversationId;

    @Column(name = "payload", nullable = false, updatable = false)
    private String payload;

    @Column(name = "correlation_id")
    private String correlationId;

    @Column(name = "irc_profile_id")
    private Integer ircProfileId;

    @Column(name = "external_thread_type", length = 50)
    private String externalThreadType;

    @Column(name = "external_thread_id", length = 255)
    private String externalThreadId;

    @Column(name = "failure_reason", nullable = false)
    private String failureReason;

    @Column(name = "total_attempts", nullable = false)
    private Integer totalAttempts;

    @Column(name = "last_error", nullable = false)
    private String lastError;

    @Column(name = "moved_at", nullable = false, updatable = false)
    private LocalDateTime movedAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "retry_attempt")
    private Boolean retryAttempt;

    @Column(name = "retried_at")
    private LocalDateTime retriedAt;

    @Column(name = "retried_by")
    private UUID retriedBy;

    @Column(name = "metadata")
    private String metadata;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected DeadLetterQueueEntry() {
        // JPA
    }

    public DeadLetterQueueEntry(UUID id, UUID messageId, UUID conversationId, String payload,
                                String failureReason, Integer totalAttempts, String lastError,
                                LocalDateTime expiresAt) {
        this.id = id == null ? UUID.randomUUID() : id;
        this.messageId = messageId;
        this.conversationId = conversationId;
        this.payload = payload;
        this.failureReason = failureReason;
        this.totalAttempts = totalAttempts;
        this.lastError = lastError;
        this.movedAt = LocalDateTime.now();
        this.expiresAt = expiresAt;
        this.createdAt = this.movedAt;
        this.updatedAt = this.movedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getMessageId() {
        return messageId;
    }

    public UUID getConversationId() {
        return conversationId;
    }

    public String getPayload() {
        return payload;
    }

    public String getCorrelationId() {
        return correlationId;
    }

    public Integer getIrcProfileId() {
        return ircProfileId;
    }

    public String getExternalThreadType() {
        return externalThreadType;
    }

    public String getExternalThreadId() {
        return externalThreadId;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public Integer getTotalAttempts() {
        return totalAttempts;
    }

    public String getLastError() {
        return lastError;
    }

    public LocalDateTime getMovedAt() {
        return movedAt;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public Boolean getRetryAttempt() {
        return retryAttempt;
    }

    public LocalDateTime getRetriedAt() {
        return retriedAt;
    }

    public UUID getRetriedBy() {
        return retriedBy;
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

    public void setCorrelationId(String correlationId) {
        this.correlationId = correlationId;
    }

    public void setIrcProfileId(Integer ircProfileId) {
        this.ircProfileId = ircProfileId;
    }

    public void setExternalThreadType(String externalThreadType) {
        this.externalThreadType = externalThreadType;
    }

    public void setExternalThreadId(String externalThreadId) {
        this.externalThreadId = externalThreadId;
    }

    public void setFailureReason(String failureReason) {
        this.failureReason = failureReason;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public void setRetryAttempt(Boolean retryAttempt) {
        this.retryAttempt = retryAttempt;
    }

    public void setRetriedAt(LocalDateTime retriedAt) {
        this.retriedAt = retriedAt;
    }

    public void setRetriedBy(UUID retriedBy) {
        this.retriedBy = retriedBy;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
