package com.yacc.conversation.service;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;
import com.yacc.auth.service.UserDirectoryService;
import com.yacc.common.controller.NotFoundException;
import com.yacc.conversation.model.AssignmentResponse;
import com.yacc.conversation.model.Conversation;
import com.yacc.conversation.repository.ConversationRepository;
import com.yacc.notification.service.NotificationService;

/**
 * POST-surface assignment (ledger row REST-ASSIGN-001; POC
 * {@code assignments.service} parity): verifies the assignee, stamps
 * assignment + activity, creates the deduped {@code assignment}
 * notification, and audits {@code conversation.assigned}.
 */
@Service
public class AssignmentService {

    private final ConversationRepository conversations;
    private final UserDirectoryService directory;
    private final NotificationService notifications;
    private final AuditPersistence audit;
    private final ObjectMapper mapper;

    public AssignmentService(ConversationRepository conversations,
            UserDirectoryService directory,
            NotificationService notifications,
            AuditPersistence audit,
            ObjectMapper mapper) {
        this.conversations = conversations;
        this.directory = directory;
        this.notifications = notifications;
        this.audit = audit;
        this.mapper = mapper;
    }

    /** Assigns a conversation to an existing user and notifies them. */
    @Transactional
    public AssignmentResponse assign(UUID conversationId, String newAssignedUserId, String actorId) {
        Conversation conversation = conversations.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        if (!directory.existsLiveById(newAssignedUserId)) {
            throw new NotFoundException("User not found");
        }
        String previouslyAssigned = conversation.getAssignedUserId();
        LocalDateTime now = LocalDateTime.now();
        conversation.setAssignedUserId(newAssignedUserId);
        conversation.setUpdatedAt(now);
        conversation.setLastActivityAt(now);
        Conversation saved = conversations.save(conversation);

        notifications.createDeduped(newAssignedUserId, "assignment", conversationId, actorId,
                "You have been assigned to a conversation", null);

        ObjectNode metadata = mapper.createObjectNode();
        metadata.put("oldAssignedUserId", previouslyAssigned);
        metadata.put("newAssignedUserId", newAssignedUserId);
        metadata.put("conversationId", conversationId.toString());
        audit.persist(new AuditRecord("conversation.assigned", "conversation",
                conversationId.toString(), actorId, metadata, null));

        return new AssignmentResponse(
                saved.getId().toString(),
                conversationId.toString(),
                previouslyAssigned,
                newAssignedUserId,
                saved.getUpdatedAt().toString());
    }
}
