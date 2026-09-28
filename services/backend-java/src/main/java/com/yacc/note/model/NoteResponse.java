package com.yacc.note.model;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Wire representation of a note (frozen contract component {@code Note};
 * POC shape with author and mentions).
 */
public record NoteResponse(
        UUID id,
        UUID conversationId,
        String authorId,
        String body,
        List<String> mentions,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
