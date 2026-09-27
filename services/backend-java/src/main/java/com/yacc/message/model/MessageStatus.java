package com.yacc.message.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Java mapping of the PostgreSQL {@code message_status} enum (MIG-020, ADR-027).
 *
 * <p>Source values: POC {@code packages/backend/src/enums/messageStatus.enum.ts}
 * — delivery state driving the retry/DLQ flow (ADR-028). Labels are the exact
 * PostgreSQL enum labels so the persistence layer (MIG-021) can translate
 * losslessly.</p>
 */
public enum MessageStatus {
    PENDING("pending"),
    SENT("sent"),
    FAILED("failed");

    private final String label;

    MessageStatus(String label) {
        this.label = label;
    }

    /** Exact PostgreSQL enum label for this status. */
    @JsonValue
    public String getLabel() {
        return label;
    }

    /** Jackson creator: wire values are the PostgreSQL labels. */
    @JsonCreator
    public static MessageStatus fromLabel(String label) {
        for (MessageStatus value : values()) {
            if (value.label.equals(label)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown message_status label: " + label);
    }
}
