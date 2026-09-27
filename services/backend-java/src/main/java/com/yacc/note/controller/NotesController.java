package com.yacc.note.controller;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.auth.model.AuthUser;
import com.yacc.common.model.BaseListResponse;
import com.yacc.note.model.CreateNoteRequest;
import com.yacc.note.model.NoteEnvelope;
import com.yacc.note.model.NoteResponse;
import com.yacc.note.service.NoteService;

import jakarta.validation.Valid;

/**
 * Note wire surface (ledger rows REST-NOTE-001/002; frozen contract ops
 * {@code listConversationNotes}, {@code createConversationNote}).
 * Authenticated users read and create notes with mention parsing.
 */
@RestController
@RequestMapping("/api/conversations/{conversationId}/notes")
public class NotesController {

    private final NoteService notes;

    public NotesController(NoteService notes) {
        this.notes = notes;
    }

    @GetMapping
    public BaseListResponse<NoteResponse> list(
            @PathVariable("conversationId") UUID conversationId,
            @RequestParam(defaultValue = "1") String page,
            @RequestParam(defaultValue = "50") String pageSize) {
        int pageNum = parseIntOrDefault(page, 1);
        int limit = parseIntOrDefault(pageSize, 50);
        var result = notes.list(conversationId, pageNum, limit);
        return BaseListResponse.of(result.items(), result.page(), result.limit(), result.total());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public NoteEnvelope create(@PathVariable("conversationId") UUID conversationId,
            @Valid @RequestBody CreateNoteRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return new NoteEnvelope(notes.create(conversationId, principal.getId(), request.body()));
    }

    private static int parseIntOrDefault(String value, int fallback) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException failure) {
            return fallback;
        }
    }
}
