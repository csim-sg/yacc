package com.yacc.api.message;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
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
 * frozen custom shape, outbound send (frozen 201/PENDING response; the
 * async connector dispatch is the MIG-062 gateway exchange, triggered by
 * the {@link MessageCreatedEvent} after the response path), the inbound
 * ingress of the connector flow (MIG-062 D2), and the once-only manual
 * retry re-expressed over the DB DLQ (ADR-028 — the P0 exactly-once rule
 * preserved).
 */
@Service
public class MessageService {

    private final MessageRepository messages;
    private final ConversationAccessService conversations;
    private final UserDirectoryService directory;
    private final DlqService dlq;
    private final ObjectMapper mapper;
    private final ApplicationEventPublisher events;

    public MessageService(MessageRepository messages, ConversationAccessService conversations,
            UserDirectoryService directory, DlqService dlq, ObjectMapper mapper,
            ApplicationEventPublisher events) {
        this.messages = messages;
        this.conversations = conversations;
        this.directory = directory;
        this.dlq = dlq;
        this.mapper = mapper;
        this.events = events;
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

    /**
     * Creates an outbound message in {@code pending} status (201 path).
     * After the frozen persistence the {@link MessageCreatedEvent} hands the
     * message to the MIG-062 connector gateway exchange, which dispatches
     * asynchronously after the response path (baseline
     * {@code dispatchToConnector} non-blocking parity; ledger
     * REST-MSG-002) — the frozen 201/PENDING response shape is unchanged.
     */
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
        Message saved = messages.save(message);
        events.publishEvent(new MessageCreatedEvent(saved.getId(), conversationId));
        return saved;
    }

    /**
     * Inbound ingress (MIG-062 D2; guardrail G9): persists one normalized
     * connector inbound message — direction {@code inbound}, status
     * {@code sent} (already delivered), the external sender display name and
     * the per-event correlation id + external sender id in the metadata
     * (POC {@code conversationService.createMessage} inbound parity). The
     * {@code sender_id} column stays unset: it is a typed FK into
     * {@code users} (V1 baseline) and external platform identities have no
     * user row — the external id rides in the metadata and the wire payload,
     * exactly the baseline shape.
     */
    @Transactional
    public Message createInbound(UUID conversationId, String senderId, String senderName,
            String body, UUID correlationId) {
        requireConversation(conversationId);
        Message message = new Message(UUID.randomUUID(), conversationId, null,
                senderName, body, MessageDirection.INBOUND);
        message.setStatus(MessageStatus.SENT);
        ObjectNode metadata = mapper.createObjectNode();
        if (senderId != null) {
            metadata.put("senderId", senderId);
        }
        if (correlationId != null) {
            metadata.put("correlationId", correlationId.toString());
        }
        if (!metadata.isEmpty()) {
            message.setMetadata(metadata.toString());
        }
        return messages.save(message);
    }

    /** The message for the dispatch path (exchange input); empty when absent. */
    @Transactional(readOnly = true)
    public Optional<Message> findForDispatch(UUID messageId) {
        return messages.findById(messageId);
    }

    /**
     * Marks one message delivered (MIG-062 outbound success parity):
     * {@code sent} + the platform {@code external_message_id}. Idempotent —
     * {@code sent} is terminal (baseline {@code canTransitionTo} parity), so
     * a duplicate redelivery never corrupts the status.
     */
    @Transactional
    public void markSent(UUID messageId, String externalMessageId) {
        Message message = messages.findById(messageId)
                .orElseThrow(() -> new NotFoundException("Message not found"));
        if (message.getStatus() == MessageStatus.SENT) {
            return;
        }
        message.setStatus(MessageStatus.SENT);
        message.setExternalMessageId(externalMessageId);
        message.setUpdatedAt(LocalDateTime.now());
        messages.save(message);
    }

    /**
     * Marks one message failed with the delivery error (MIG-062 outbound
     * failure parity). {@code sent} is terminal — a late failure after a
     * success never corrupts the status (baseline transition parity). The
     * existing metadata members (the send correlation id) are preserved and
     * the error recorded under {@code error} (baseline error/correlation
     * metadata parity).
     */
    @Transactional
    public void markFailed(UUID messageId, String error) {
        Message message = messages.findById(messageId)
                .orElseThrow(() -> new NotFoundException("Message not found"));
        if (message.getStatus() == MessageStatus.SENT) {
            return;
        }
        message.setStatus(MessageStatus.FAILED);
        ObjectNode metadata = metadataObject(message.getMetadata());
        metadata.put("error", error);
        message.setMetadata(metadata.toString());
        message.setUpdatedAt(LocalDateTime.now());
        messages.save(message);
    }

    /** Reads (or creates) the metadata object of a raw jsonb string. */
    private ObjectNode metadataObject(String metadata) {
        if (metadata == null || metadata.isBlank()) {
            return mapper.createObjectNode();
        }
        try {
            var node = mapper.readTree(metadata);
            if (node instanceof ObjectNode object) {
                return object;
            }
        } catch (RuntimeException | com.fasterxml.jackson.core.JsonProcessingException malformed) {
            // unparseable metadata reads as absent — a fresh object replaces it
        }
        return mapper.createObjectNode();
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
