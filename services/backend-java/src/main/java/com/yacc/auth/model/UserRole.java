package com.yacc.auth.model;

/**
 * Java mapping of the PostgreSQL {@code user_role} enum (MIG-020, ADR-027).
 *
 * <p>Source values: POC {@code packages/backend/src/enums/userRole.enum.ts} —
 * the 4-role RBAC matrix (ADR-025, SPEC-002). Labels are the exact PostgreSQL
 * enum labels so the persistence layer (MIG-021) can translate losslessly
 * between JPA constants and database values.</p>
 */
public enum UserRole {
    SUPER_ADMIN("super_admin"),
    ADMIN("admin"),
    MANAGER("manager"),
    USER("user");

    private final String label;

    UserRole(String label) {
        this.label = label;
    }

    /** Exact PostgreSQL enum label for this role. */
    public String getLabel() {
        return label;
    }

    /** Resolves a PostgreSQL {@code user_role} label to its Java constant. */
    public static UserRole fromLabel(String label) {
        for (UserRole value : values()) {
            if (value.label.equals(label)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown user_role label: " + label);
    }
}
