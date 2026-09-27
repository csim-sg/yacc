package com.yacc.auth.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * JPA persistence mapping for {@link UserRole} over the PostgreSQL native
 * {@code user_role} enum column type (MIG-021; ADR-027).
 *
 * <p>Converts between the Java constant and the exact PostgreSQL enum label
 * carried by {@code UserRole#getLabel()}/{@code fromLabel(String)} (MIG-020),
 * so the database never sees Java constant names.</p>
 */
@Converter(autoApply = false)
public class UserRoleConverter implements AttributeConverter<UserRole, String> {

    @Override
    public String convertToDatabaseColumn(UserRole attribute) {
        return attribute == null ? null : attribute.getLabel();
    }

    @Override
    public UserRole convertToEntityAttribute(String dbData) {
        return dbData == null ? null : UserRole.fromLabel(dbData);
    }
}
