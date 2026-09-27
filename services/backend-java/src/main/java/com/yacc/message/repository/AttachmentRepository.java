package com.yacc.message.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.message.model.Attachment;

/**
 * Spring Data JPA repository for {@link Attachment} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface AttachmentRepository extends JpaRepository<Attachment, java.util.UUID> {
}
