package com.yacc.conversation.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Java mapping of the PostgreSQL {@code channel_type} enum (MIG-020, ADR-027).
 *
 * <p>Source values: POC {@code packages/backend/src/enums/channelType.enum.ts} —
 * supported communication platforms (telegram, irc live; the rest are
 * reserved for later phases). Labels are the exact PostgreSQL enum labels so
 * the persistence layer (MIG-021) can translate losslessly.</p>
 */
public enum ChannelType {
    TELEGRAM("telegram"),
    IRC("irc"),
    WHATSAPP("whatsapp"),
    WECHAT("wechat"),
    META("meta"),
    X("x"),
    EMAIL("email"),
    SLACK("slack");

    private final String label;

    ChannelType(String label) {
        this.label = label;
    }

    /** Exact PostgreSQL enum label for this channel type. */
    @JsonValue
    public String getLabel() {
        return label;
    }

    /** Resolves a PostgreSQL {@code channel_type} label to its Java constant; Jackson creator. */
    @JsonCreator
    public static ChannelType fromLabel(String label) {
        for (ChannelType value : values()) {
            if (value.label.equals(label)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Unknown channel_type label: " + label);
    }
}
