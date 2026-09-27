package com.yacc.audit.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.audit.model.AuditLog;

/**
 * Spring Data JPA repository for {@link AuditLog} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface AuditLogRepository extends JpaRepository<AuditLog, java.util.UUID> {
}
