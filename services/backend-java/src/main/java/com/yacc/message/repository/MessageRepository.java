package com.yacc.message.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.message.model.Message;

/**
 * Spring Data JPA repository for {@link Message} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface MessageRepository extends JpaRepository<Message, java.util.UUID> {
}
