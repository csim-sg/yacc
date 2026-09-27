package com.yacc.message.controller;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.auth.model.AuthUser;
import com.yacc.auth.model.UserRole;
import com.yacc.common.controller.ForbiddenException;
import com.yacc.conversation.service.ConversationAccessService;
import com.yacc.message.model.Message;
import com.yacc.message.model.MessageEnvelope;
import com.yacc.message.model.MessageListResponse;
import com.yacc.message.model.MessageResponse;
import com.yacc.message.model.MessageStatusResponse;
import com.yacc.message.model.SendMessageBody;
import com.yacc.message.service.MessageService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/**
 * Message wire surface (ledger rows REST-MSG-001..004; frozen contract ops
 * {@code getConversationMessages}, {@code sendConversationMessage},
 * {@code retryConversationMessage}, {@code getConversationMessageStatus}).
 * GET list returns the frozen custom shape (deliberately NOT
 * BaseListResponse); POST send is open to all four roles; retry requires
 * conversation assignment for {@code user}-role identities (POC RBAC).
 */
@RestController
@RequestMapping("/api/conversations/{conversationId}/messages")
public class MessageController {

    private final MessageService messages;
    private final ConversationAccessService access;
    private final ObjectMapper mapper;

    public MessageController(MessageService messages, ConversationAccessService access,
            ObjectMapper mapper) {
        this.messages = messages;
        this.access = access;
        this.mapper = mapper;
    }

    @GetMapping
    public MessageListResponse list(
            @PathVariable("conversationId") UUID conversationId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer limit) {
        var result = messages.list(conversationId, page == null ? 1 : page,
                limit == null ? 50 : limit);
        return new MessageListResponse(
                result.messages().stream()
                        .map(message -> MessageResponse.from(message, mapper))
                        .toList(),
                result.total(), result.page(), result.limit());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MessageEnvelope send(@PathVariable("conversationId") UUID conversationId,
            @Valid @RequestBody SendMessageBody request,
            @AuthenticationPrincipal AuthUser principal,
            HttpServletRequest servletRequest) {
        Message message = messages.send(conversationId, principal.getId(), request.body(),
                servletRequest.getHeader("X-Correlation-Id"));
        return new MessageEnvelope(MessageResponse.from(message, mapper));
    }

    @PostMapping("/{messageId}/retry")
    public ResponseEntity<MessageEnvelope> retry(
            @PathVariable("conversationId") UUID conversationId,
            @PathVariable("messageId") UUID messageId,
            @AuthenticationPrincipal AuthUser principal) {
        if (principal.getRole() == UserRole.USER
                && !access.isAssignedTo(conversationId, principal.getId())) {
            throw new ForbiddenException("You do not have permission to retry this message");
        }
        Message message = messages.retry(conversationId, messageId, principal.getId());
        return ResponseEntity.ok(new MessageEnvelope(MessageResponse.from(message, mapper)));
    }

    @GetMapping("/{messageId}/status")
    public MessageStatusResponse status(
            @PathVariable("conversationId") UUID conversationId,
            @PathVariable("messageId") UUID messageId) {
        MessageResponse message = messages.status(conversationId, messageId);
        return new MessageStatusResponse(message.id(), message.status(), message.createdAt(),
                message.updatedAt());
    }
}
