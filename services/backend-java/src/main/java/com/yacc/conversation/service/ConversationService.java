package com.yacc.conversation.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;
import com.yacc.auth.model.User;
import com.yacc.auth.service.UserDirectoryService;
import com.yacc.common.controller.BadRequestException;
import com.yacc.common.controller.NotFoundException;
import com.yacc.conversation.model.ChannelType;
import com.yacc.conversation.model.Conversation;
import com.yacc.conversation.model.ConversationDetail;
import com.yacc.conversation.model.ConversationListItem;
import com.yacc.conversation.model.ListConversationsQuery;
import com.yacc.conversation.model.Participant;
import com.yacc.conversation.model.TagRef;
import com.yacc.conversation.repository.ConversationRepository;
import com.yacc.conversation.repository.ConversationTagRepository;
import com.yacc.message.service.MessageQueryService;
import com.yacc.tag.service.TagService;

/**
 * Conversation management (ledger rows REST-CONV-001..005; POC
 * {@code conversation.service} parity): filtered/paginated listing with
 * enrichment, single fetch, and the status/priority/assignment mutations
 * with audit parity. Composes through public service APIs of the auth,
 * message, and tag contexts (ADR-030).
 */
@Service
public class ConversationService {

    private final ConversationRepository conversations;
    private final ConversationTagRepository conversationTags;
    private final MessageQueryService messageQueries;
    private final UserDirectoryService directory;
    private final TagService tags;
    private final AuditPersistence audit;
    private final ObjectMapper mapper;

    public ConversationService(ConversationRepository conversations,
            ConversationTagRepository conversationTags,
            MessageQueryService messageQueries,
            UserDirectoryService directory,
            TagService tags,
            AuditPersistence audit,
            ObjectMapper mapper) {
        this.conversations = conversations;
        this.conversationTags = conversationTags;
        this.messageQueries = messageQueries;
        this.directory = directory;
        this.tags = tags;
        this.audit = audit;
        this.mapper = mapper;
    }

    /** Enriched, filtered, paginated conversation list (POC list parity). */
    @Transactional(readOnly = true)
    public ConversationPage list(ListConversationsQuery query) {
        int page = query.page() == null ? 1 : query.page();
        int limit = query.limit() == null ? 20 : query.limit();
        if (page < 1) {
            throw new BadRequestException("Invalid query: page must be a positive integer");
        }
        if (limit < 1 || limit > 100) {
            throw new BadRequestException("Invalid query: limit must be an integer between 1 and 100");
        }
        if (query.channel() != null && !isValidChannel(query.channel())) {
            throw new BadRequestException("Invalid query: channel must be one of telegram, irc");
        }

        Specification<Conversation> spec = (root, queryRoot, cb) -> cb.conjunction();
        if (query.channel() != null) {
            spec = spec.and(ConversationRepository.hasChannel(ChannelType.fromLabel(query.channel())));
        }
        if (query.status() != null) {
            spec = spec.and(ConversationRepository.hasStatus(query.status()));
        }
        if (query.priority() != null) {
            spec = spec.and(ConversationRepository.hasPriority(query.priority()));
        }
        if (query.assignedUserId() != null) {
            spec = spec.and(ConversationRepository.hasAssignee(query.assignedUserId()));
        }
        if (query.tagId() != null) {
            spec = spec.and(ConversationRepository.hasTag(query.tagId()));
        }
        if (query.search() != null && !query.search().isBlank()) {
            spec = spec.and(ConversationRepository.matchesSearch(query.search()));
        }
        if (query.dateFrom() != null) {
            spec = spec.and(ConversationRepository.lastActivityFrom(parseDate(query.dateFrom(), "dateFrom")));
        }
        if (query.dateTo() != null) {
            spec = spec.and(ConversationRepository.lastActivityTo(parseDate(query.dateTo(), "dateTo")));
        }
        if (query.unread()) {
            spec = spec.and(ConversationRepository.hasInboundMessage());
        }

        Sort sort = sortOf(query.sortBy(), query.sortOrder());
        var result = conversations.findAll(spec, PageRequest.of(page - 1, limit, sort));
        List<ConversationListItem> items = result.getContent().stream().map(this::toListItem).toList();
        return new ConversationPage(items, result.getTotalElements(), page, limit);
    }

    /** Single enriched conversation. */
    @Transactional(readOnly = true)
    public ConversationDetail get(UUID conversationId) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        return new ConversationDetail(
                conversation.getId().toString(),
                conversation.getChannel().getLabel(),
                conversation.getExternalThreadId(),
                conversation.getStatus().getLabel(),
                conversation.getPriority().getLabel(),
                conversation.getAssignedUserId(),
                tagsOf(conversationId),
                participantsOf(conversationId),
                conversation.getCreatedAt(),
                conversation.getUpdatedAt());
    }

    /** Updates status and returns the old value for the audit row. */
    @Transactional
    public ConversationUpdate updateStatus(UUID conversationId, String newStatus, User actor) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        String oldStatus = conversation.getStatus().getLabel();
        conversation.setStatus(com.yacc.conversation.model.ConversationStatus.fromLabel(newStatus));
        conversation.setUpdatedAt(LocalDateTime.now());
        Conversation saved = conversations.save(conversation);
        auditEvent(actor, "conversation_status_change", conversationId, builder -> builder
                .put("oldStatus", oldStatus).put("newStatus", newStatus));
        return new ConversationUpdate(detail(saved), oldStatus);
    }

    /** Updates priority and returns the old value for the audit row. */
    @Transactional
    public ConversationUpdate updatePriority(UUID conversationId, String newPriority, User actor) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        String oldPriority = conversation.getPriority().getLabel();
        conversation.setPriority(com.yacc.conversation.model.ConversationPriority.fromLabel(newPriority));
        conversation.setUpdatedAt(LocalDateTime.now());
        Conversation saved = conversations.save(conversation);
        auditEvent(actor, "conversation_priority_change", conversationId, builder -> builder
                .put("oldPriority", oldPriority).put("newPriority", newPriority));
        return new ConversationUpdate(detail(saved), oldPriority);
    }

    /**
     * PATCH-surface assignment (admin/super_admin, op
     * {@code assignConversationByPatch}); unlike the POST surface it does not
     * verify the assignee identity (POC parity) and touches only
     * {@code assignedUserId}/{@code updatedAt}.
     */
    @Transactional
    public ConversationUpdate assignByPatch(UUID conversationId, String assignedUserId, User actor) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        String oldAssigned = conversation.getAssignedUserId();
        conversation.setAssignedUserId(assignedUserId);
        conversation.setUpdatedAt(LocalDateTime.now());
        Conversation saved = conversations.save(conversation);
        auditEvent(actor, "conversation_assigned", conversationId, builder -> builder
                .put("oldAssignedUserId", oldAssigned).put("newAssignedUserId", assignedUserId));
        return new ConversationUpdate(detail(saved), oldAssigned);
    }

    /** Links a tag to a conversation (idempotent). Caller owns access checks. */
    @Transactional
    public void linkTag(UUID conversationId, Integer tagId) {
        if (conversationTags.existsByIdConversationIdAndIdTagId(conversationId, tagId)) {
            return;
        }
        conversationTags.save(new com.yacc.conversation.model.ConversationTag(
                new com.yacc.conversation.model.ConversationTagId(conversationId, tagId)));
    }

    /** Unlinks a tag from a conversation (graceful when absent). */
    @Transactional
    public void unlinkTag(UUID conversationId, Integer tagId) {
        conversationTags.findById(new com.yacc.conversation.model.ConversationTagId(conversationId, tagId))
                .ifPresent(conversationTags::delete);
    }

    /** Current tag refs of a conversation. */
    @Transactional(readOnly = true)
    public List<TagRef> tagsOf(UUID conversationId) {
        return conversationTags.findByIdConversationId(conversationId).stream()
                .map(link -> tags.getTagRef(link.getId().tagId()))
                .flatMap(java.util.Optional::stream)
                .toList();
    }

    private ConversationListItem toListItem(Conversation conversation) {
        UUID id = conversation.getId();
        String assignedUserName = conversation.getAssignedUserId() == null ? null
                : directory.findById(conversation.getAssignedUserId())
                        .map(User::getEmail).orElse(null);
        var latest = messageQueries.latestMessage(id).orElse(null);
        return new ConversationListItem(
                id.toString(),
                conversation.getChannel().getLabel(),
                conversation.getExternalThreadId(),
                conversation.getStatus().getLabel(),
                conversation.getPriority().getLabel(),
                conversation.getAssignedUserId(),
                assignedUserName,
                tagsOf(id),
                participantsOf(id),
                messageQueries.countInbound(id),
                latest == null ? null : latest.getBody(),
                latest == null ? null : latest.getCreatedAt(),
                conversation.getCreatedAt(),
                conversation.getUpdatedAt());
    }

    private List<Participant> participantsOf(UUID conversationId) {
        return messageQueries.inboundSenderNames(conversationId).stream()
                .filter(name -> name != null && !name.isBlank())
                .map(Participant::contact)
                .toList();
    }

    private ConversationDetail detail(Conversation conversation) {
        return new ConversationDetail(
                conversation.getId().toString(),
                conversation.getChannel().getLabel(),
                conversation.getExternalThreadId(),
                conversation.getStatus().getLabel(),
                conversation.getPriority().getLabel(),
                conversation.getAssignedUserId(),
                tagsOf(conversation.getId()),
                participantsOf(conversation.getId()),
                conversation.getCreatedAt(),
                conversation.getUpdatedAt());
    }

    private void auditEvent(User actor, String action, UUID conversationId,
            java.util.function.Consumer<ObjectNode> shape) {
        ObjectNode metadata = mapper.createObjectNode();
        shape.accept(metadata);
        audit.persist(new AuditRecord(action, "conversation", conversationId.toString(),
                actor.getId(), metadata, null));
    }

    private Sort sortOf(String sortBy, String sortOrder) {
        Sort.Direction direction = "asc".equalsIgnoreCase(sortOrder) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String property = switch (sortBy == null ? "lastActivity" : sortBy) {
            case "created" -> "createdAt";
            case "priority" -> "priority";
            case "lastActivity" -> "lastActivityAt";
            default -> throw new BadRequestException(
                    "Invalid query: sortBy must be one of lastActivity, created, priority");
        };
        return Sort.by(direction, property);
    }

    private LocalDateTime parseDate(String value, String field) {
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException failure) {
            try {
                return java.time.LocalDate.parse(value).atStartOfDay();
            } catch (DateTimeParseException ignored) {
                throw new BadRequestException("Invalid query: " + field + " must be an ISO date");
            }
        }
    }

    private static boolean isValidChannel(String label) {
        for (ChannelType channel : ChannelType.values()) {
            if (channel.getLabel().equals(label)) {
                return true;
            }
        }
        return false;
    }

    /** One enriched list page.
     *
     * @param items page items
     * @param total matching conversations
     * @param page 1-indexed page
     * @param limit page size
     */
    public record ConversationPage(List<ConversationListItem> items, long total, int page, int limit) {
    }

    /**
     * Mutation outcome.
     *
     * @param conversation enriched conversation after the change
     * @param oldValue previous status/priority/assignee (audit parity)
     */
    public record ConversationUpdate(ConversationDetail conversation, String oldValue) {
    }
}
