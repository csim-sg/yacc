package com.yacc.note.repository;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.yacc.note.model.Note;

/**
 * Spring Data JPA repository for {@link Note} (MIG-021; ADR-027).
 * Derived queries only — no raw SQL.
 */
public interface NoteRepository extends JpaRepository<Note, UUID> {

    Page<Note> findByConversationId(UUID conversationId, Pageable pageable);

    long countByConversationId(UUID conversationId);
}
