package com.yacc.auth.model;

/**
 * Java mapping of the PostgreSQL {@code user_status} enum (MIG-020, ADR-027).
 *
 * <p>Source values: POC {@code packages/backend/src/enums/userStatus.enum.ts} —
 * account state enforced at every REST/WS entry point (ADR-025: inactive and
 * suspended accounts cannot authenticate). Labels are the exact PostgreSQL
 * enum labels so the persistence layer (MIG-021) can translate losslessly.</p>
 */
public enum UserStatus {
    ACTIVE("active"),
    INACTIVE("inactive"),
    SUSPENDED("suspended");

    private final String label;

    UserStatus(String label) {
        this.label = label;
    }

    /** Exact PostgreSQL enum label for this status. */
    public String getLabel() {
        return label;
    }

    /** Resolves a PostgreSQL {@code user_status} label to its Java constant. */
    public static UserStatus fromLabel(String label) {
        for (UserStatus value : values()) {
            if (value.label.equals(label)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown user_status label: " + label);
    }
}
