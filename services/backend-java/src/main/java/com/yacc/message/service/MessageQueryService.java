package com.yacc.message.service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.message.model.Message;
import com.yacc.message.model.MessageDirection;
import com.yacc.message.model.MessageStatus;
import com.yacc.message.repository.MessageRepository;

/**
 * Public read API of the {@code message} bounded context (ADR-030 boundary
 * rule): feature services that need message data — conversation-list
 * enrichment, queue statistics — depend on THIS service, never on the
 * message repository.
 */
@Service
public class MessageQueryService {

    private final MessageRepository messages;

    public MessageQueryService(MessageRepository messages) {
        this.messages = messages;
    }

    /** Latest message of a conversation by creation time, if any. */
    @Transactional(readOnly = true)
    public Optional<Message> latestMessage(UUID conversationId) {
        return messages.findFirstByConversationIdOrderByCreatedAtDesc(conversationId);
    }

    /** Count of inbound messages (POC unread approximation). */
    @Transactional(readOnly = true)
    public long countInbound(UUID conversationId) {
        return messages.countByConversationIdAndDirection(conversationId, MessageDirection.INBOUND);
    }

    /** Distinct inbound sender names (up to 10, POC participant parity). */
    @Transactional(readOnly = true)
    public List<String> inboundSenderNames(UUID conversationId) {
        return messages.findDistinctSenderNames(conversationId, MessageDirection.INBOUND,
                PageRequest.of(0, 10, Sort.by("senderName"))).getContent();
    }

    /** Live message count by status (queue statistics input). */
    @Transactional(readOnly = true)
    public long countByStatus(MessageStatus status) {
        return messages.countByStatus(status);
    }
}
