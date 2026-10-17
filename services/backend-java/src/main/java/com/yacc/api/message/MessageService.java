package com.yacc.api.message;

import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.service.UserDirectoryService;
import com.yacc.common.controller.BadRequestException;
import com.yacc.common.controller.NotFoundException;
import com.yacc.api.conversation.ConversationAccessService;
import com.yacc.service.DlqService;
import com.yacc.entity.Message;
import com.yacc.entity.MessageDirection;
import com.yacc.api.message.MessagePage;
import com.yacc.entity.MessageStatus;
import com.yacc.api.message.MessageResponse;
import com.yacc.repository.MessageRepository;

/**
 * Message management (ledger rows REST-MSG-001..004; POC
 * {@code message.service} parity): conversation message listing with the
 * frozen custom shape, outbound send (pending status; connector dispatch is
 * Phase 6 scope), and the once-only manual retry re-expressed over the DB
 * DLQ (ADR-028 — the P0 exactly-once rule preserved).
 */
@Service
public class MessageService {

    private final MessageRepository messages;
    private final ConversationAccessService conversations;
    private final UserDirectoryService directory;
    private final DlqService dlq;
    private final ObjectMapper mapper;

    public MessageService(MessageRepository messages, ConversationAccessService conversations,
            UserDirectoryService directory, DlqService dlq, ObjectMapper mapper) {
        this.messages = messages;
        this.conversations = conversations;
        this.directory = directory;
        this.dlq = dlq;
        this.mapper = mapper;
    }

    /** Message page with the frozen custom shape {@code {messages,total,...}}. */
    @Transactional(readOnly = true)
    public MessagePage list(UUID conversationId, int page, int limit) {
        requireConversation(conversationId);
        int safePage = Math.max(1, page);
        int safeLimit = Math.min(100, Math.max(1, limit));
        var result = messages.findByConversationId(conversationId,
                PageRequest.of(safePage - 1, safeLimit, Sort.by(Sort.Direction.ASC, "createdAt")));
        return new MessagePage(result.getContent(), result.getTotalElements(), safePage, safeLimit);
    }

    /** Creates an outbound message in {@code pending} status (201 path). */
    @Transactional
    public Message send(UUID conversationId, String senderId, String body, String correlationId) {
        requireConversation(conversationId);
        Message message = new Message(UUID.randomUUID(), conversationId, senderId,
                directory.displayName(senderId), body, MessageDirection.OUTBOUND);
        message.setStatus(MessageStatus.PENDING);
        if (correlationId != null) {
            ObjectNode metadata = mapper.createObjectNode();
            metadata.put("correlationId", correlationId);
            message.setMetadata(metadata.toString());
        }
        return messages.save(message);
    }

    /**
     * Manual retry — exactly once per message (ledger row REST-MSG-003):
     * only failed messages with an un-retried DLQ entry are eligible; the
     * DLQ row is marked retried and the MIG-063 Quartz retry worker
     * consumes the marker for redelivery (ADR-028 — the P0 exactly-once
     * rule preserved).
     */
    @Transactional
    public Message retry(UUID conversationId, UUID messageId, String userId) {
        requireConversation(conversationId);
        Message message = messages.findById(messageId)
                .filter(candidate -> candidate.getConversationId().equals(conversationId))
                .orElseThrow(() -> new NotFoundException("Message not found"));
        if (message.getStatus() != MessageStatus.FAILED) {
            throw new BadRequestException("Cannot retry message with status "
                    + message.getStatus().getLabel());
        }
        var entry = dlq.findByMessageId(messageId)
                .orElseThrow(() -> new BadRequestException(
                        "Cannot retry message with status " + message.getStatus().getLabel()));
        if (Boolean.TRUE.equals(entry.getRetryAttempt())) {
            throw new BadRequestException("Message has already been retried");
        }
        dlq.markRetried(entry.getId(), UUID.fromString(userId));
        return message;
    }

    /** Status lookup for one conversation message. */
    @Transactional(readOnly = true)
    public MessageResponse status(UUID conversationId, UUID messageId) {
        requireConversation(conversationId);
        Message message = messages.findById(messageId)
                .filter(candidate -> candidate.getConversationId().equals(conversationId))
                .orElseThrow(() -> new NotFoundException("Message not found"));
        return MessageResponse.from(message, mapper);
    }

    private void requireConversation(UUID conversationId) {
        if (!conversations.exists(conversationId)) {
            throw new NotFoundException("Conversation not found");
        }
    }
}
