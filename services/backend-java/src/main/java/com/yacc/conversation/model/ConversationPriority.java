package com.yacc.conversation.model;

/**
 * Java mapping of the PostgreSQL {@code conversation_priority} enum
 * (MIG-020, ADR-027).
 *
 * <p>Source values: POC
 * {@code packages/backend/src/enums/conversationPriority.enum.ts}, in its
 * final form after the POC's {@code 0002_fix_priority_enum} migration
 * ('medium' renamed to 'normal'). Labels are the exact PostgreSQL enum labels
 * so the persistence layer (MIG-021) can translate losslessly.</p>
 */
public enum ConversationPriority {
    LOW("low"),
    NORMAL("normal"),
    HIGH("high"),
    URGENT("urgent");

    private final String label;

    ConversationPriority(String label) {
        this.label = label;
    }

    /** Exact PostgreSQL enum label for this priority. */
    public String getLabel() {
        return label;
    }

    /** Resolves a PostgreSQL {@code conversation_priority} label to its Java constant. */
    public static ConversationPriority fromLabel(String label) {
        for (ConversationPriority value : values()) {
            if (value.label.equals(label)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown conversation_priority label: " + label);
    }
}
