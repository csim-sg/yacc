package com.yacc.conversation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.conversation.model.ConversationTag;
import com.yacc.conversation.model.ConversationTagId;

/**
 * Spring Data JPA repository for {@link ConversationTag} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface ConversationTagRepository extends JpaRepository<ConversationTag, ConversationTagId> {
}
