package com.yacc.note.model;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Create-note body (frozen contract component {@code CreateNoteBody}).
 *
 * @param body note text (required, ≤10000 — POC service parity)
 * @param replyToMessageId optional referenced message
 * @param isInternal internal note flag (default false)
 */
public record CreateNoteRequest(
        @NotBlank @Size(max = 10000) String body,
        UUID replyToMessageId,
        Boolean isInternal) {

    /** Normalizes the optional flag to its frozen default. */
    public boolean internalOrDefault() {
        return isInternal != null && isInternal;
    }
}
