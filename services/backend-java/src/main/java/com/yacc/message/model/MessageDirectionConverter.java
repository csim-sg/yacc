package com.yacc.message.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA persistence mapping for {@link MessageDirection} over the PostgreSQL
 * native {@code message_direction} enum column type (MIG-021; ADR-027).
 *
 * <p>Converts between the Java constant and the exact PostgreSQL enum label
 * carried by {@code MessageDirection#getLabel()}/{@code fromLabel(String)}
 * (MIG-020), so the database never sees Java constant names.</p>
 */
@Converter(autoApply = false)
public class MessageDirectionConverter implements AttributeConverter<MessageDirection, String> {

    @Override
    public String convertToDatabaseColumn(MessageDirection attribute) {
        return attribute == null ? null : attribute.getLabel();
    }

    @Override
    public MessageDirection convertToEntityAttribute(String dbData) {
        return dbData == null ? null : MessageDirection.fromLabel(dbData);
    }
}
