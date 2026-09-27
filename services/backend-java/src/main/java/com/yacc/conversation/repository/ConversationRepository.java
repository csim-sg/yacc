package com.yacc.conversation.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.conversation.model.Conversation;

/**
 * Spring Data JPA repository for {@link Conversation} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface ConversationRepository extends JpaRepository<Conversation, java.util.UUID> {
}
