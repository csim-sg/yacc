package com.yacc.entity;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * JPA entity for the {@code websocket_backlog} table (MIG-051; Flyway V2,
 * ADR-028) — the durable per-user WebSocket event backlog that replaces the
 * POC's Redis {@code ws:backlog:{userId}} keys. One row per stored event,
 * mirroring the POC {@code BacklogEntry} shape: event name, optional
 * conversation scope, JSON payload, emission time and 1h expiry.
 *
 * <p>The 1h rolling window is expressed by {@code expires_at}: replay reads
 * filter on it, and a scheduled sweep deletes expired rows (storage hygiene;
 * replay correctness never depends on the sweep). {@code payload} maps the
 * {@code jsonb} column via {@code @JdbcTypeCode(SqlTypes.JSON)} exactly like
 * {@link RawPayload} — the stored text is the event payload JSON; the
 * enveloped frame is rebuilt at replay time. No migration accompanies this
 * entity: the V2 table is used as-is (ADR-027).</p>
 */
@Entity
@Table(name = "websocket_backlog")
public class WebSocketBacklogEntry {

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

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", nullable = false, updatable = false)
    private String payload;

    @Column(name = "emitted_at", nullable = false, updatable = false)
    private LocalDateTime emittedAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private LocalDateTime expiresAt;

    protected WebSocketBacklogEntry() {
        // JPA
    }

    public WebSocketBacklogEntry(String userId, String eventName, UUID conversationId,
            String payload, LocalDateTime emittedAt, LocalDateTime expiresAt) {
        this.userId = userId;
        this.eventName = eventName;
        this.conversationId = conversationId;
        this.payload = payload;
        this.emittedAt = emittedAt;
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
}
