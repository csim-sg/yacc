package com.yacc.realtime.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code websocket_backlog} table (MIG-021; V2 migration,
 * ADR-028) — the durable re-home of the POC Redis WS event backlog (1h
 * rolling window). {@code user_id} is a plain key column (no FK in the
 * schema). Backlog replay behavior is MIG-051; this is the persistence
 * mapping only.
 */
@Entity
@Table(name = "websocket_backlog")
public class WebSocketBacklog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private String userId;

    @Column(name = "event_name", nullable = false, updatable = false, length = 100)
    private String eventName;

    @Column(name = "conversation_id", updatable = false)
    private UUID conversationId;

    @Column(name = "payload", nullable = false, updatable = false)
    private String payload;

    @Column(name = "emitted_at", nullable = false, updatable = false)
    private LocalDateTime emittedAt;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    protected WebSocketBacklog() {
        // JPA
    }

    public WebSocketBacklog(String userId, String eventName, UUID conversationId,
                            String payload, LocalDateTime expiresAt) {
        this.userId = userId;
        this.eventName = eventName;
        this.conversationId = conversationId;
        this.payload = payload;
        this.emittedAt = LocalDateTime.now();
        this.expiresAt = expiresAt;
    }

    public Long getId() {
        return id;
    }

    public String getUserId() {
        return userId;
    }

    public String getEventName() {
        return eventName;
    }

    public UUID getConversationId() {
        return conversationId;
    }

    public String getPayload() {
        return payload;
    }

    public LocalDateTime getEmittedAt() {
        return emittedAt;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }
}
