package com.yacc.note.service;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;
import com.yacc.common.controller.NotFoundException;
import com.yacc.conversation.service.ConversationAccessService;
import com.yacc.note.model.Note;
import com.yacc.note.model.NotePage;
import com.yacc.note.model.NoteResponse;
import com.yacc.note.repository.NoteRepository;
import com.yacc.notification.service.NotificationService;

/**
 * Note management (ledger rows REST-NOTE-001/002; POC {@code notes.service}
 * parity): conversation-scoped listing with clamped pagination and creation
 * with mention parsing, mention notifications (best-effort), and the
 * {@code note.created} audit event.
 */
@Service
public class NoteService {

    private final NoteRepository notes;
    private final ConversationAccessService conversations;
    private final MentionParser mentions;
    private final NotificationService notifications;
    private final AuditPersistence audit;
    private final ObjectMapper mapper;

    public NoteService(NoteRepository notes, ConversationAccessService conversations,
            MentionParser mentions, NotificationService notifications,
            AuditPersistence audit, ObjectMapper mapper) {
        this.notes = notes;
        this.conversations = conversations;
        this.mentions = mentions;
        this.notifications = notifications;
        this.audit = audit;
        this.mapper = mapper;
    }

    /** Note page for a conversation (clamped 1..100 page size, POC parity). */
    @Transactional(readOnly = true)
    public NotePage list(UUID conversationId, int page, int pageSize) {
        requireConversation(conversationId);
        int safePage = Math.max(1, page);
        int limit = Math.min(100, Math.max(1, pageSize));
        var result = notes.findByConversationId(conversationId,
                PageRequest.of(safePage - 1, limit, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<NoteResponse> items = result.getContent().stream().map(this::toResponse).toList();
        return new NotePage(items, result.getTotalElements(), safePage, limit);
    }

    /** Creates a note, resolving @mentions into notifications. */
    @Transactional
    public NoteResponse create(UUID conversationId, String authorId, String body) {
        requireConversation(conversationId);
        List<String> mentionedUserIds = mentions.resolve(mentions.extract(body));
        Note note = notes.save(new Note(UUID.randomUUID(), conversationId, authorId, body.trim()));
        note.setMentions(toJson(mentionedUserIds));
        Note saved = notes.save(note);

        for (String mentionedUserId : mentionedUserIds) {
            notifications.createDeduped(mentionedUserId, "mention", conversationId, authorId,
                    "@mentioned in a note", null);
        }

        ObjectNode metadata = mapper.createObjectNode();
        metadata.put("noteLength", body.length());
        metadata.put("mentionCount", mentionedUserIds.size());
        audit.persist(new AuditRecord("note.created", "conversation", conversationId.toString(),
                authorId, metadata, null));

        return toResponse(saved, mentionedUserIds);
    }

    private NoteResponse toResponse(Note note) {
        return toResponse(note, parseMentions(note.getMentions()));
    }

    private NoteResponse toResponse(Note note, List<String> mentionedUserIds) {
        return new NoteResponse(note.getId(), note.getConversationId(), note.getAuthorId(),
                note.getBody(), mentionedUserIds, note.getCreatedAt(), note.getUpdatedAt());
    }

    private List<String> parseMentions(String stored) {
        if (stored == null) {
            return List.of();
        }
        try {
            List<String> ids = new java.util.ArrayList<>();
            mapper.readTree(stored).forEach(node -> ids.add(node.asText()));
            return ids;
        } catch (java.io.IOException ignored) {
            return List.of();
        }
    }

    /** JSON-boundary edge: the notes.mentions column is jsonb. */
    private String toJson(List<String> mentionedUserIds) {
        if (mentionedUserIds.isEmpty()) {
            return null;
        }
        return mapper.createArrayNode()
                .addAll(mentionedUserIds.stream().map(mapper.getNodeFactory()::textNode).toList())
                .toString();
    }

    private void requireConversation(UUID conversationId) {
        if (!conversations.exists(conversationId)) {
            throw new NotFoundException("Conversation not found");
        }
    }
}
