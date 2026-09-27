package com.yacc.auth.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA persistence mapping for {@link UserStatus} over the PostgreSQL native
 * {@code user_status} enum column type (MIG-021; ADR-027).
 *
 * <p>Converts between the Java constant and the exact PostgreSQL enum label
 * carried by {@code UserStatus#getLabel()}/{@code fromLabel(String)} (MIG-020),
 * so the database never sees Java constant names.</p>
 */
@Converter(autoApply = false)
public class UserStatusConverter implements AttributeConverter<UserStatus, String> {

    @Override
    public String convertToDatabaseColumn(UserStatus attribute) {
        return attribute == null ? null : attribute.getLabel();
    }

    @Override
    public UserStatus convertToEntityAttribute(String dbData) {
        return dbData == null ? null : UserStatus.fromLabel(dbData);
    }
}
