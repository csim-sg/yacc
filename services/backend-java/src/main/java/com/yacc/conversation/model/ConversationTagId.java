package com.yacc.conversation.model;

import java.io.Serializable;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

/**
 * Composite identifier for {@link ConversationTag} — the
 * {@code conversation_tags (conversation_id, tag_id)} join primary key
 * (MIG-021; V1 baseline, ADR-027).
 */
@Embeddable
public record ConversationTagId(

        @Column(name = "conversation_id", nullable = false, updatable = false)
        UUID conversationId,

        @Column(name = "tag_id", nullable = false, updatable = false)
        Integer tagId
) implements Serializable {
}
