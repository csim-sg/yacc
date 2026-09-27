package com.yacc.dlq.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.dlq.model.DeadLetterQueueEntry;

/**
 * Spring Data JPA repository for {@link DeadLetterQueueEntry} (MIG-021;
 * ADR-027/ARCH-004 §7). DLQ retry semantics arrive with MIG-063.
 */
public interface DeadLetterQueueEntryRepository extends JpaRepository<DeadLetterQueueEntry, java.util.UUID> {
}
