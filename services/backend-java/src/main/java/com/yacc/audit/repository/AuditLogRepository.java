package com.yacc.audit.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.yacc.audit.model.AuditLog;

/**
 * Spring Data JPA repository for {@link AuditLog} (MIG-021; ADR-027).
 * Derived queries + specifications only — no raw SQL.
 */
public interface AuditLogRepository
        extends JpaRepository<AuditLog, UUID>, JpaSpecificationExecutor<AuditLog> {
}
