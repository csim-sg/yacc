package com.yacc.conversation.controller;

import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.yacc.auth.model.AuthUser;
import com.yacc.common.model.BaseListResponse;
import com.yacc.conversation.model.AssignRequest;
import com.yacc.conversation.model.ConversationDetail;
import com.yacc.conversation.model.ConversationListItem;
import com.yacc.conversation.model.ConversationPriority;
import com.yacc.conversation.model.ConversationStatus;
import com.yacc.conversation.model.ListConversationsQuery;
import com.yacc.conversation.model.UpdatePriorityRequest;
import com.yacc.conversation.model.UpdateStatusRequest;
import com.yacc.conversation.service.ConversationService;

import jakarta.validation.Valid;

/**
 * Conversation wire surface (ledger rows REST-CONV-001..005; frozen
 * contract ops {@code listConversations}, {@code getConversation},
 * {@code updateConversationStatus}, {@code updateConversationPriority},
 * {@code assignConversationByPatch}). Any authenticated user may read;
 * status needs admin+, priority manager+, PATCH-assignment admin+.
 * {@code /api} is declared at this controller level (no global prefix).
 */
@RestController
@RequestMapping("/api/conversations")
public class ConversationsController {

    private final ConversationService conversations;

    public ConversationsController(ConversationService conversations) {
        this.conversations = conversations;
    }

    @GetMapping
    public BaseListResponse<ConversationListItem> list(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) ConversationStatus status,
            @RequestParam(required = false) ConversationPriority priority,
            @RequestParam(required = false) String assignedUserId,
            @RequestParam(required = false) Integer tagId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String unread,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortOrder) {
        var result = conversations.list(new ListConversationsQuery(page, limit, channel, status,
                priority, assignedUserId, tagId, search, dateFrom, dateTo,
                "true".equals(unread), sortBy, sortOrder));
        return BaseListResponse.of(result.items(), result.page(), result.limit(), result.total());
    }

    @GetMapping("/{id}")
    public ConversationEnvelope get(@PathVariable("id") UUID id) {
        return new ConversationEnvelope(conversations.get(id));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','MANAGER')")
    public ConversationEnvelope updateStatus(@PathVariable("id") UUID id,
            @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return new ConversationEnvelope(
                conversations.updateStatus(id, request.status().getLabel(), principal.user()).conversation());
    }

    @PatchMapping("/{id}/priority")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','MANAGER','ADMIN')")
    public ConversationEnvelope updatePriority(@PathVariable("id") UUID id,
            @Valid @RequestBody UpdatePriorityRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return new ConversationEnvelope(
                conversations.updatePriority(id, request.priority().getLabel(), principal.user()).conversation());
    }

    @PatchMapping("/{id}/assign")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN')")
    public ConversationEnvelope assignByPatch(@PathVariable("id") UUID id,
            @Valid @RequestBody AssignRequest request,
            @AuthenticationPrincipal AuthUser principal) {
        return new ConversationEnvelope(
                conversations.assignByPatch(id, request.assignedUserId(), principal.user()).conversation());
    }

    /**
     * Single-result envelope {@code {data: <conversation>}} (frozen
     * contract convention).
     *
     * @param data the conversation
     */
    public record ConversationEnvelope(ConversationDetail data) {
    }
}
