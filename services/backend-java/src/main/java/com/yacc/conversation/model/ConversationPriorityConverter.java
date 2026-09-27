package com.yacc.conversation.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA persistence mapping for {@link ConversationPriority} over the PostgreSQL
 * native {@code conversation_priority} enum column type (MIG-021; ADR-027).
 *
 * <p>Converts between the Java constant and the exact PostgreSQL enum label
 * carried by {@code ConversationPriority#getLabel()}/{@code fromLabel(String)}
 * (MIG-020), so the database never sees Java constant names.</p>
 */
@Converter(autoApply = false)
public class ConversationPriorityConverter implements AttributeConverter<ConversationPriority, String> {

    @Override
    public String convertToDatabaseColumn(ConversationPriority attribute) {
        return attribute == null ? null : attribute.getLabel();
    }

    @Override
    public ConversationPriority convertToEntityAttribute(String dbData) {
        return dbData == null ? null : ConversationPriority.fromLabel(dbData);
    }
}
