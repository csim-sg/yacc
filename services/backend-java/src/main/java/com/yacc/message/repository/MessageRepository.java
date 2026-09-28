package com.yacc.message.repository;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.yacc.message.model.Message;
import com.yacc.message.model.MessageDirection;
import com.yacc.message.model.MessageStatus;

/**
 * Spring Data JPA repository for {@link Message} (MIG-021; ADR-027).
 * Derived queries only — no raw SQL.
 */
public interface MessageRepository extends JpaRepository<Message, UUID> {

    Page<Message> findByConversationId(UUID conversationId, Pageable pageable);

    Page<Message> findByConversationIdAndDirection(UUID conversationId, MessageDirection direction,
            Pageable pageable);

    long countByConversationId(UUID conversationId);

    long countByConversationIdAndDirection(UUID conversationId, MessageDirection direction);

    long countByStatus(MessageStatus status);

    java.util.Optional<Message> findFirstByConversationIdOrderByCreatedAtDesc(UUID conversationId);

    @org.springframework.data.jpa.repository.Query(
            "select distinct m.senderName from Message m where m.conversationId = :conversationId"
                    + " and m.direction = :direction order by m.senderName")
    org.springframework.data.domain.Page<String> findDistinctSenderNames(
            @org.springframework.lang.NonNull UUID conversationId,
            @org.springframework.lang.NonNull MessageDirection direction,
            org.springframework.data.domain.Pageable pageable);
}
