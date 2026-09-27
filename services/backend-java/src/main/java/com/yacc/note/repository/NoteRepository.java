package com.yacc.note.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.note.model.Note;

/**
 * Spring Data JPA repository for {@link Note} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface NoteRepository extends JpaRepository<Note, java.util.UUID> {
}
