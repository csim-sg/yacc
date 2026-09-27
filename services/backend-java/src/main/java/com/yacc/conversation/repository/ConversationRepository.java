package com.yacc.conversation.repository;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.yacc.conversation.model.ChannelType;
import com.yacc.conversation.model.Conversation;
import com.yacc.conversation.model.ConversationPriority;
import com.yacc.conversation.model.ConversationStatus;
import com.yacc.message.model.Message;
import com.yacc.message.model.MessageDirection;

import jakarta.persistence.criteria.Predicate;

/**
 * Spring Data JPA repository for {@link Conversation} (MIG-021; ADR-027).
 * Derived queries + specifications only — no raw SQL. The list-filter
 * specifications traverse the relational model (messages join) as criteria
 * subqueries; persistence-model traversal stays inside the owning
 * repository (ARCH-004 §7).
 */
public interface ConversationRepository
        extends JpaRepository<Conversation, UUID>, JpaSpecificationExecutor<Conversation> {

    /** Specification matching conversations tagged with the given tag id. */
    static Specification<Conversation> hasTag(Integer tagId) {
        return (root, query, cb) -> {
            var tagged = query.subquery(UUID.class);
            var tagRoot = tagged.from(com.yacc.conversation.model.ConversationTag.class);
            tagged.select(tagRoot.get("id").get("conversationId"))
                    .where(cb.equal(tagRoot.get("id").get("tagId"), tagId));
            return root.get("id").in(tagged);
        };
    }

    /** Specification matching conversations with at least one inbound message. */
    static Specification<Conversation> hasInboundMessage() {
        return (root, query, cb) -> {
            var inbound = query.subquery(UUID.class);
            var messageRoot = inbound.from(Message.class);
            inbound.select(messageRoot.get("conversationId"))
                    .where(cb.equal(messageRoot.get("direction"), MessageDirection.INBOUND));
            return root.get("id").in(inbound);
        };
    }

    /**
     * Specification matching the POC search: title, external thread id, or
     * any message body/sender-name substring (case-insensitive).
     */
    static Specification<Conversation> matchesSearch(String search) {
        String like = "%" + search.toLowerCase() + "%";
        return (root, query, cb) -> {
            var matches = query.subquery(UUID.class);
            var messageRoot = matches.from(Message.class);
            matches.select(messageRoot.get("conversationId"))
                    .where(cb.or(
                            cb.like(cb.lower(messageRoot.get("body")), like),
                            cb.like(cb.lower(messageRoot.get("senderName")), like)));
            Predicate messageMatch = root.get("id").in(matches);
            Predicate titleMatch = cb.like(cb.lower(root.get("title")), like);
            Predicate threadMatch = cb.like(cb.lower(root.get("externalThreadId")), like);
            return cb.or(titleMatch, threadMatch, messageMatch);
        };
    }

    /** Specification filtering by channel. */
    static Specification<Conversation> hasChannel(ChannelType channel) {
        return (root, query, cb) -> cb.equal(root.get("channel"), channel);
    }

    /** Specification filtering by status. */
    static Specification<Conversation> hasStatus(ConversationStatus status) {
        return (root, query, cb) -> cb.equal(root.get("status"), status);
    }

    /** Specification filtering by priority. */
    static Specification<Conversation> hasPriority(ConversationPriority priority) {
        return (root, query, cb) -> cb.equal(root.get("priority"), priority);
    }

    /** Specification filtering by assignee. */
    static Specification<Conversation> hasAssignee(String assignedUserId) {
        return (root, query, cb) -> cb.equal(root.get("assignedUserId"), assignedUserId);
    }

    boolean existsByIdAndAssignedUserId(UUID id, String assignedUserId);

    /** Best-effort bulk assignment update; returns affected row count. */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(
            "update Conversation c set c.assignedUserId = :assigneeId, c.updatedAt = :now"
                    + " where c.id = :id")
    int updateAssignment(@org.springframework.lang.NonNull UUID id, String assigneeId,
            @org.springframework.lang.NonNull java.time.LocalDateTime now);

    /** Specification lower-bounding last activity. */
    static Specification<Conversation> lastActivityFrom(LocalDateTime from) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("lastActivityAt"), from);
    }

    /** Specification upper-bounding last activity. */
    static Specification<Conversation> lastActivityTo(LocalDateTime to) {
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("lastActivityAt"), to);
    }
}
