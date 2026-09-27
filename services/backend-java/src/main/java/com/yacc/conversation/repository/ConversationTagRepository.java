package com.yacc.conversation.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.conversation.model.ConversationTag;
import com.yacc.conversation.model.ConversationTagId;

/**
 * Spring Data JPA repository for {@link ConversationTag} (MIG-021; ADR-027/ARCH-004 §7).
 * Derived queries only — no raw SQL.
 */
public interface ConversationTagRepository extends JpaRepository<ConversationTag, ConversationTagId> {

    List<ConversationTag> findByIdConversationId(UUID conversationId);

    boolean existsByIdConversationIdAndIdTagId(UUID conversationId, Integer tagId);
}
