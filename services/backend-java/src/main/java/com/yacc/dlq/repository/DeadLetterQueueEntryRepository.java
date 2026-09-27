package com.yacc.dlq.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.yacc.dlq.model.DeadLetterQueueEntry;

/**
 * Spring Data JPA repository for {@link DeadLetterQueueEntry} (MIG-021;
 * ADR-027/ADR-028). Derived queries only — no raw SQL.
 */
public interface DeadLetterQueueEntryRepository extends JpaRepository<DeadLetterQueueEntry, UUID> {

    Optional<DeadLetterQueueEntry> findByMessageId(UUID messageId);

    List<DeadLetterQueueEntry> findByFailureReason(String failureReason);

    Page<DeadLetterQueueEntry> findByFailureReason(String failureReason, Pageable pageable);
}
