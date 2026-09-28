package com.yacc.note.model;

import java.util.List;

/**
 * One note page.
 *
 * @param items page items
 * @param total all notes of the conversation
 * @param page  1-indexed page
 * @param limit page size
 */
public record NotePage(List<NoteResponse> items, long total, int page, int limit) {
}
