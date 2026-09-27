package com.yacc.user.model;

/**
 * Account status (PG enum {@code user_status}, V1 baseline — MIG-020; ADR-027).
 *
 * <p>{@code INACTIVE} and {@code SUSPENDED} accounts must be denied
 * authentication and protected REST/WS access (enforced from MIG-030).</p>
 */
public enum UserStatus {
    ACTIVE("active"),
    INACTIVE("inactive"),
    SUSPENDED("suspended");

    private final String databaseValue;

    UserStatus(String databaseValue) {
        this.databaseValue = databaseValue;
    }

    /** PostgreSQL enum label as stored by the V1 baseline migration. */
    public String getDatabaseValue() {
        return databaseValue;
    }
}
