package com.yacc.note.model;

/**
 * Single-note envelope {@code {data: Note}}.
 *
 * @param data the note
 */
public record NoteEnvelope(NoteResponse data) {
}
