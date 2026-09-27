package com.yacc.message.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Java mapping of the PostgreSQL {@code message_direction} enum
 * (MIG-020, ADR-027).
 *
 * <p>Source values: POC
 * {@code packages/backend/src/enums/messageDirection.enum.ts} — inbound
 * (received from an external platform) vs outbound (sent to one). Labels are
 * the exact PostgreSQL enum labels so the persistence layer (MIG-021) can
 * translate losslessly.</p>
 */
public enum MessageDirection {
    INBOUND("inbound"),
    OUTBOUND("outbound");

    private final String label;

    MessageDirection(String label) {
        this.label = label;
    }

    /** Exact PostgreSQL enum label for this direction. */
    @JsonValue
    public String getLabel() {
        return label;
    }

    /** Jackson creator: wire values are the PostgreSQL labels. */
    @JsonCreator
    public static MessageDirection fromLabel(String label) {
        for (MessageDirection value : values()) {
            if (value.label.equals(label)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown message_direction label: " + label);
    }
}
