package com.yacc.conversation.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA persistence mapping for {@link ChannelType} over the PostgreSQL native
 * {@code channel_type} enum column type (MIG-021; ADR-027).
 *
 * <p>Converts between the Java constant and the exact PostgreSQL enum label
 * carried by {@code ChannelType#getLabel()}/{@code fromLabel(String)} (MIG-020),
 * so the database never sees Java constant names.</p>
 */
@Converter(autoApply = false)
public class ChannelTypeConverter implements AttributeConverter<ChannelType, String> {

    @Override
    public String convertToDatabaseColumn(ChannelType attribute) {
        return attribute == null ? null : attribute.getLabel();
    }

    @Override
    public ChannelType convertToEntityAttribute(String dbData) {
        return dbData == null ? null : ChannelType.fromLabel(dbData);
    }
}
