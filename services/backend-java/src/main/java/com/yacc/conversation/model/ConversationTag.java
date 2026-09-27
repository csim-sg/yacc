package com.yacc.conversation.model;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code conversation_tags} join table (MIG-021; V1
 * baseline, ADR-027). Composite primary key via {@link ConversationTagId}.
 */
@Entity
@Table(name = "conversation_tags")
public class ConversationTag {

    @EmbeddedId
    private ConversationTagId id;

    protected ConversationTag() {
        // JPA
    }

    public ConversationTag(ConversationTagId id) {
        this.id = id;
    }

    public ConversationTagId getId() {
        return id;
    }
}
