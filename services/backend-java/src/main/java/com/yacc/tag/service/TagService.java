package com.yacc.tag.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;
import com.yacc.tag.model.CreateTagRequest;
import com.yacc.tag.model.Tag;
import com.yacc.tag.repository.TagRepository;

/**
 * Tag management (ledger rows REST-TAG-001/002; POC {@code tag.service}
 * parity): tag listing/creation with the {@code tag.created} audit trail.
 * Conversation↔tag linking lives with the conversation bounded context
 * (junction-table owner); this service exposes the tag-existence and
 * tag-reference reads other contexts compose through (ADR-030).
 */
@Service
public class TagService {

    private final TagRepository tags;
    private final AuditPersistence audit;
    private final ObjectMapper mapper;

    public TagService(TagRepository tags, AuditPersistence audit, ObjectMapper mapper) {
        this.tags = tags;
        this.audit = audit;
        this.mapper = mapper;
    }

    /** All tags ordered by name (POC parity). */
    @Transactional(readOnly = true)
    public List<Tag> list() {
        return tags.findAll(org.springframework.data.domain.Sort.by("name"));
    }

    /** Creates a tag (default color #808080, POC parity) with audit. */
    @Transactional
    public Tag create(CreateTagRequest request, String createdById) {
        Tag tag = tags.save(new Tag(request.name(), request.color() == null ? "#808080" : request.color(),
                createdById));
        ObjectNode metadata = mapper.createObjectNode();
        metadata.put("tagId", tag.getId());
        metadata.put("tagName", tag.getName());
        metadata.put("color", tag.getColor());
        // Nil-UUID entity: global tag creation (POC parity).
        audit.persist(new AuditRecord("tag.created", "conversation",
                "00000000-0000-0000-0000-000000000000", createdById, metadata, null));
        return tag;
    }

    /** Tag by id. */
    @Transactional(readOnly = true)
    public Optional<Tag> findById(Integer tagId) {
        return tags.findById(tagId);
    }

    /** True when the tag exists (cross-context composition read). */
    @Transactional(readOnly = true)
    public boolean exists(Integer tagId) {
        return tags.existsById(tagId);
    }

    /**
     * Lightweight tag reference for conversation views; empty when the tag
     * vanished (deleted concurrently).
     */
    @Transactional(readOnly = true)
    public Optional<com.yacc.conversation.model.TagRef> getTagRef(Integer tagId) {
        return tags.findById(tagId)
                .map(tag -> new com.yacc.conversation.model.TagRef(tag.getId(), tag.getName(),
                        tag.getColor()));
    }
}
