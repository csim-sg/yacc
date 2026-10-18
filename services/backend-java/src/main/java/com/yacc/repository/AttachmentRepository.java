package com.yacc.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.entity.Attachment;

/**
 * Spring Data JPA repository for {@link Attachment} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface AttachmentRepository extends JpaRepository<Attachment, java.util.UUID> {
}
