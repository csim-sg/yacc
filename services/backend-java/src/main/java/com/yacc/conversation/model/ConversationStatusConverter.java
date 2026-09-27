package com.yacc.conversation.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA persistence mapping for {@link ConversationStatus} over the PostgreSQL
 * native {@code conversation_status} enum column type (MIG-021; ADR-027).
 *
 * <p>Converts between the Java constant and the exact PostgreSQL enum label
 * carried by {@code ConversationStatus#getLabel()}/{@code fromLabel(String)}
 * (MIG-020), so the database never sees Java constant names.</p>
 */
@Converter(autoApply = false)
public class ConversationStatusConverter implements AttributeConverter<ConversationStatus, String> {

    @Override
    public String convertToDatabaseColumn(ConversationStatus attribute) {
        return attribute == null ? null : attribute.getLabel();
    }

    @Override
    public ConversationStatus convertToEntityAttribute(String dbData) {
        return dbData == null ? null : ConversationStatus.fromLabel(dbData);
    }
}
