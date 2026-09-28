package com.yacc.tag.controller;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.auth.model.AuthUser;
import com.yacc.common.controller.ForbiddenException;
import com.yacc.common.controller.NotFoundException;
import com.yacc.conversation.service.ConversationAccessService;
import com.yacc.conversation.service.ConversationService;
import com.yacc.tag.model.AddTagBody;
import com.yacc.tag.model.ConversationTagsEnvelope;

import jakarta.validation.Valid;

/**
 * Conversation tag-link wire surface (ledger rows REST-TAG-003/004; frozen
 * contract ops {@code addTagToConversation}, {@code removeTagFromConversation}).
 * GOV-021: any authenticated role, guarded by resource-level conversation
 * access. Split from the tag-library controller because the two route
 * families share no path prefix — {@code /api} is declared at this
 * controller level (ARCH-004 §5).
 */
@RestController
@RequestMapping("/api/conversations/{id}/tags")
public class ConversationTagController {

    private final com.yacc.tag.service.TagService tags;
    private final ConversationService conversations;
    private final ConversationAccessService access;

    public ConversationTagController(com.yacc.tag.service.TagService tags,
            ConversationService conversations, ConversationAccessService access) {
        this.tags = tags;
        this.conversations = conversations;
        this.access = access;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationTagsEnvelope addTag(@PathVariable("id") UUID conversationId,
            @Valid @RequestBody AddTagBody body,
            @AuthenticationPrincipal AuthUser principal) {
        requireAccess(conversationId, principal);
        requireConversation(conversationId);
        if (!tags.exists(body.tagId())) {
            throw new NotFoundException("Conversation or tag not found");
        }
        conversations.linkTag(conversationId, body.tagId());
        return new ConversationTagsEnvelope(conversations.tagsOf(conversationId));
    }

    @DeleteMapping("/{tagId}")
    public ConversationTagsEnvelope removeTag(@PathVariable("id") UUID conversationId,
            @PathVariable("tagId") int tagId,
            @AuthenticationPrincipal AuthUser principal) {
        requireAccess(conversationId, principal);
        requireConversation(conversationId);
        if (!tags.exists(tagId)) {
            throw new NotFoundException("Conversation or tag not found");
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
            throw new NotFoundException("Conversation not found");
        }
    }
}
