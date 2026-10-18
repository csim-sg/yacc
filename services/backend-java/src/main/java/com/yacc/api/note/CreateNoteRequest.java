package com.yacc.api.note;

import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
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
        // Contract CreateNoteBody: replyToMessageId/isInternal are optional and
        // non-nullable — omitted when absent, never null (MIG-102).
        @JsonInclude(JsonInclude.Include.NON_NULL) UUID replyToMessageId,
        @JsonInclude(JsonInclude.Include.NON_NULL) Boolean isInternal) {

    /** Normalizes the optional flag to its frozen default. */
    public boolean internalOrDefault() {
        return isInternal != null && isInternal;
    }
}
