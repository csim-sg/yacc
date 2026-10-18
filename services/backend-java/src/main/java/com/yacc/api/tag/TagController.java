package com.yacc.api.tag;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.api.auth.AuthUser;
import com.yacc.api.tag.CreateTagRequest;
import com.yacc.api.tag.TagEnvelope;
import com.yacc.api.tag.TagResponse;
import com.yacc.api.tag.TagsEnvelope;
import com.yacc.api.tag.TagService;

import jakarta.validation.Valid;

/**
 * Tag library wire surface (ledger rows REST-TAG-001/002; frozen contract
 * ops {@code listTags}, {@code createTag}). GOV-021: any authenticated role
 * may list and create tags. Conversation tag links live in
 * {@link ConversationTagController} — the two route families share no path
 * prefix, so {@code /api} is declared at each controller level (ARCH-004 §5).
 */
@RestController
@RequestMapping("/api/tags")
public class TagController {

    private final TagService tags;

    public TagController(TagService tags) {
        this.tags = tags;
    }

    @GetMapping
    public TagsEnvelope list() {
        return new TagsEnvelope(tags.list().stream().map(TagResponse::from).toList());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TagEnvelope create(@Valid @RequestBody CreateTagRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return new TagEnvelope(TagResponse.from(tags.create(request, principal.getId())));
    }
}
