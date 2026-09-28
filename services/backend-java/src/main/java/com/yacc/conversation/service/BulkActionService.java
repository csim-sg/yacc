package com.yacc.conversation.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;
import com.yacc.common.controller.BadRequestException;
import com.yacc.conversation.model.BulkActionFailure;
import com.yacc.conversation.model.BulkActionRequest;
import com.yacc.conversation.model.BulkActionResponseData;
import com.yacc.conversation.model.ConversationStatus;
import com.yacc.conversation.repository.ConversationRepository;
import com.yacc.conversation.repository.ConversationTagRepository;
import com.yacc.tag.service.TagService;

/**
 * Best-effort bulk actions over conversations (ledger row REST-BULK-001;
 * POC {@code bulkActions.service} parity): each conversation is processed
 * independently, per-success {@code bulk_action_applied} audit rows, safe
 * failure reasons, max 100 targets. Cross-context reads compose through the
 * tag context's public service API (ADR-030).
 */
@Service
public class BulkActionService {

    private final ConversationRepository conversations;
    private final ConversationTagRepository conversationTags;
    private final TagService tags;
    private final AuditPersistence audit;
    private final ObjectMapper mapper;

    public BulkActionService(ConversationRepository conversations,
            ConversationTagRepository conversationTags,
            TagService tags,
            AuditPersistence audit,
            ObjectMapper mapper) {
        this.conversations = conversations;
        this.conversationTags = conversationTags;
        this.tags = tags;
        this.audit = audit;
        this.mapper = mapper;
    }

    /** Dispatches the frozen action set (assign | tag | status). */
    @Transactional
    public BulkActionResponseData apply(BulkActionRequest request, String actorId) {
        return switch (request.action()) {
            case "assign" -> assign(request, assigneeOf(request), actorId);
            case "tag" -> tag(request, tagIdOf(request), actorId);
            case "status" -> status(request, statusOf(request), actorId);
            default -> throw new BadRequestException("action must be one of: assign, tag, status");
        };
    }

    private BulkActionResponseData assign(BulkActionRequest request, String assigneeId, String actorId) {
        List<BulkActionFailure> failures = new ArrayList<>();
        int success = 0;
        for (UUID conversationId : request.conversationIds()) {
            try {
                int updated = conversations.updateAssignment(conversationId, assigneeId, LocalDateTime.now());
                if (updated == 0) {
                    failures.add(new BulkActionFailure(conversationId.toString(), "Conversation not found"));
                    continue;
                }
                auditBulk(actorId, conversationId, "assign", builder -> builder.put("assigneeId", assigneeId));
                success++;
            } catch (RuntimeException failure) {
                // FK violation on the assignee mirrors the POC's safe failure reason
                failures.add(new BulkActionFailure(conversationId.toString(), "Assignee user not found"));
            }
        }
        return new BulkActionResponseData(success, failures.size(), failures);
    }

    private BulkActionResponseData tag(BulkActionRequest request, Integer tagId, String actorId) {
        List<BulkActionFailure> failures = new ArrayList<>();
        int success = 0;
        if (!tags.exists(tagId)) {
            List<BulkActionFailure> all = request.conversationIds().stream()
                    .map(id -> new BulkActionFailure(id.toString(), "Tag not found")).toList();
            return new BulkActionResponseData(0, request.conversationIds().size(), all);
        }
        for (UUID conversationId : request.conversationIds()) {
            try {
                if (!conversationTags.existsByIdConversationIdAndIdTagId(conversationId, tagId)) {
                    conversationTags.save(new com.yacc.conversation.model.ConversationTag(
                            new com.yacc.conversation.model.ConversationTagId(conversationId, tagId)));
                }
                auditBulk(actorId, conversationId, "tag", builder -> builder.put("tagId", tagId));
                success++;
            } catch (RuntimeException failure) {
                failures.add(new BulkActionFailure(conversationId.toString(), "Tagging operation failed"));
            }
        }
        return new BulkActionResponseData(success, failures.size(), failures);
    }

    private BulkActionResponseData status(BulkActionRequest request, ConversationStatus newStatus,
            String actorId) {
        List<BulkActionFailure> failures = new ArrayList<>();
        int success = 0;
        for (UUID conversationId : request.conversationIds()) {
            var current = conversations.findById(conversationId);
            if (current.isEmpty()) {
                failures.add(new BulkActionFailure(conversationId.toString(), "Conversation not found"));
                continue;
            }
            String oldStatus = current.get().getStatus().getLabel();
            current.get().setStatus(newStatus);
            current.get().setUpdatedAt(LocalDateTime.now());
            conversations.save(current.get());
            String finalOldStatus = oldStatus;
            auditBulk(actorId, conversationId, "status", builder -> builder
                    .put("oldStatus", finalOldStatus).put("newStatus", newStatus.getLabel()));
            success++;
        }
        return new BulkActionResponseData(success, failures.size(), failures);
    }

    private String assigneeOf(BulkActionRequest request) {
        var value = request.data().get("assigneeId");
        if (value == null || value.isNull()) {
            return null;
        }
        if (!value.isTextual()) {
            throw new BadRequestException("assigneeId must be a string or null");
        }
        return value.asText();
    }

    private Integer tagIdOf(BulkActionRequest request) {
        var value = request.data().get("tagId");
        if (value == null || !value.canConvertToInt() || value.asInt() < 1) {
            throw new BadRequestException("tagId must be a positive integer");
        }
        return value.asInt();
    }

    private ConversationStatus statusOf(BulkActionRequest request) {
        var value = request.data().get("status");
        if (value == null || !value.isTextual()) {
            throw new BadRequestException("status must be one of: open, pending, resolved");
        }
        try {
            return ConversationStatus.fromLabel(value.asText());
        } catch (IllegalArgumentException failure) {
            throw new BadRequestException("status must be one of: open, pending, resolved");
        }
    }

    private void auditBulk(String actorId, UUID conversationId, String action,
            java.util.function.Consumer<ObjectNode> shape) {
        ObjectNode metadata = mapper.createObjectNode();
        metadata.put("action", action);
        shape.accept(metadata);
        metadata.put("bulkOperation", true);
        audit.persist(new AuditRecord("bulk_action_applied", "conversation",
                conversationId.toString(), actorId, metadata, null));
    }
}
