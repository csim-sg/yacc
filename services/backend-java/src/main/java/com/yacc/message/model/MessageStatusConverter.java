package com.yacc.message.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA persistence mapping for {@link MessageStatus} over the PostgreSQL native
 * {@code message_status} enum column type (MIG-021; ADR-027).
 *
 * <p>Converts between the Java constant and the exact PostgreSQL enum label
 * carried by {@code MessageStatus#getLabel()}/{@code fromLabel(String)} (MIG-020),
 * so the database never sees Java constant names.</p>
 */
@Converter(autoApply = false)
public class MessageStatusConverter implements AttributeConverter<MessageStatus, String> {

    @Override
    public String convertToDatabaseColumn(MessageStatus attribute) {
        return attribute == null ? null : attribute.getLabel();
    }

    @Override
    public MessageStatus convertToEntityAttribute(String dbData) {
        return dbData == null ? null : MessageStatus.fromLabel(dbData);
    }
}
