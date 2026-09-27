package com.yacc.tag.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.auth.model.AuthUser;
import com.yacc.common.controller.ForbiddenException;
import com.yacc.conversation.service.ConversationAccessService;
import com.yacc.conversation.service.ConversationService;
import com.yacc.tag.model.CreateTagRequest;
import com.yacc.tag.model.TagResponse;
import com.yacc.tag.service.TagService;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * Tag wire surface (ledger rows REST-TAG-001..004; frozen contract ops
 * {@code listTags}, {@code createTag}, {@code addTagToConversation},
 * {@code removeTagFromConversation}). GOV-021: any authenticated role may
 * list/create tags and link/unlink with resource-level conversation access.
 * The controller base is {@code /api} (POC parity — tag routes span
 * {@code /api/tags} and {@code /api/conversations/:id/tags}).
 */
@RestController
public class TagController {

    private final TagService tags;
    private final ConversationService conversations;
    private final ConversationAccessService access;

    public TagController(TagService tags, ConversationService conversations,
            ConversationAccessService access) {
        this.tags = tags;
        this.conversations = conversations;
        this.access = access;
    }

    @GetMapping("/api/tags")
    public TagsEnvelope list() {
        return new TagsEnvelope(tags.list().stream().map(TagResponse::from).toList());
    }

    @PostMapping("/api/tags")
    @ResponseStatus(HttpStatus.CREATED)
    public TagEnvelope create(@Valid @RequestBody CreateTagRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return new TagEnvelope(TagResponse.from(tags.create(request, principal.getId())));
    }

    @PostMapping("/api/conversations/{id}/tags")
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationTagsEnvelope addTag(@PathVariable("id") UUID conversationId,
            @Valid @RequestBody AddTagBody body,
            @AuthenticationPrincipal AuthUser principal) {
        requireAccess(conversationId, principal);
        requireConversation(conversationId);
        if (!tags.exists(body.tagId())) {
            throw new com.yacc.common.controller.NotFoundException("Conversation or tag not found");
        }
        conversations.linkTag(conversationId, body.tagId());
        return new ConversationTagsEnvelope(conversations.tagsOf(conversationId));
    }

    @DeleteMapping("/api/conversations/{id}/tags/{tagId}")
    public ConversationTagsEnvelope removeTag(@PathVariable("id") UUID conversationId,
            @PathVariable("tagId") int tagId,
            @AuthenticationPrincipal AuthUser principal) {
        requireAccess(conversationId, principal);
        requireConversation(conversationId);
        if (!tags.exists(tagId)) {
            throw new com.yacc.common.controller.NotFoundException("Conversation or tag not found");
        }
        conversations.unlinkTag(conversationId, tagId);
        return new ConversationTagsEnvelope(conversations.tagsOf(conversationId));
    }

    private void requireAccess(UUID conversationId, AuthUser principal) {
        if (!access.canAccess(principal, conversationId)) {
            throw new ForbiddenException("Not authorized to access this conversation");
        }
    }

    private void requireConversation(UUID conversationId) {
        if (!access.exists(conversationId)) {
            throw new com.yacc.common.controller.NotFoundException("Conversation not found");
        }
    }

    /** Tag-list envelope {@code {data: [Tag]}}. */
    public record TagsEnvelope(List<TagResponse> data) {
    }

    /** Single-tag envelope {@code {data: Tag}}. */
    public record TagEnvelope(TagResponse data) {
    }

    /**
     * Conversation-tags envelope {@code {data: {tags: [...]}}} (POC parity
     * for link/unlink results; contract `data` is a loose object).
     *
     * @param data wrapper holding the conversation's tags
     */
    public record ConversationTagsEnvelope(TagsWrapper data) {

        public ConversationTagsEnvelope(java.util.List<com.yacc.conversation.model.TagRef> tags) {
            this(new TagsWrapper(tags));
        }

        /** POC {@code {tags: [...]}} holder. */
        public record TagsWrapper(java.util.List<com.yacc.conversation.model.TagRef> tags) {
        }
    }

    /** Link-tag body (frozen contract: integer tagId ≥ 1). */
    public record AddTagBody(@NotNull @Positive Integer tagId) {
    }
}
