package com.yacc.conversation.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Java mapping of the PostgreSQL {@code conversation_status} enum
 * (MIG-020, ADR-027).
 *
 * <p>Source values: POC
 * {@code packages/backend/src/enums/conversationStatus.enum.ts}. Labels are
 * the exact PostgreSQL enum labels so the persistence layer (MIG-021) can
 * translate losslessly.</p>
 */
public enum ConversationStatus {
    OPEN("open"),
    PENDING("pending"),
    RESOLVED("resolved");

    private final String label;

    ConversationStatus(String label) {
        this.label = label;
    }

    /** Exact PostgreSQL enum label for this status. */
    @JsonValue
    public String getLabel() {
        return label;
    }

    /** Jackson creator: wire values are the PostgreSQL labels. */
    @JsonCreator
    public static ConversationStatus fromLabel(String label) {
        for (ConversationStatus value : values()) {
            if (value.label.equals(label)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown conversation_status label: " + label);
    }
}
