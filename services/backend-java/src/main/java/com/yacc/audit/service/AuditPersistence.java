package com.yacc.audit.service;

import com.yacc.audit.model.AuditRecord;

/**
 * Persistence hook for audit records (MIG-011 scope: "audit event publishing +
 * persistence hook"; SPEC-002 TR-07).
 *
 * <p>The {@code audit_logs} table (Flyway baseline) and its JPA repository are
 * delivered by MIG-020/MIG-021, which replace the interim structured-log
 * implementation. Until then no audit record is dropped — everything is
 * persisted through the structured audit log with the POC field shape.</p>
 */
public interface AuditPersistence {

    /**
     * Persist one audit record.
     *
     * @param record the audit record (never null)
     */
    void persist(AuditRecord record);
}
