package com.yacc.user.model;

/**
 * Account role (PG enum {@code user_role}, V1 baseline — MIG-020; ADR-027).
 *
 * <p>Values mirror the PostgreSQL enum labels verbatim; the approved RBAC
 * matrix (4 roles, least privilege) is enforced from MIG-030 onward.</p>
 */
public enum UserRole {
    SUPER_ADMIN("super_admin"),
    ADMIN("admin"),
    MANAGER("manager"),
    USER("user");

    private final String databaseValue;

    UserRole(String databaseValue) {
        this.databaseValue = databaseValue;
    }

    /** PostgreSQL enum label as stored by the V1 baseline migration. */
    public String getDatabaseValue() {
        return databaseValue;
    }
}
