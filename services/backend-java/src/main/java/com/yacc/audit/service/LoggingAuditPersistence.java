package com.yacc.audit.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.yacc.audit.model.AuditRecord;

/**
 * Interim {@link AuditPersistence} that persists audit records through the
 * structured audit log (SLF4J/logback JSON in production) with field-shape
 * parity to the POC {@code auditLogger}: a top-level {@code audit: true} flag
 * plus the audit fields. Correlation ids arrive via MDC when the record is
 * produced inside a request scope.
 *
 * <p>Superseded by {@link JpaAuditPersistence} (MIG-040), which persists into
 * the {@code audit_logs} table so the audit-query endpoints see the records.
 * This class is kept as the log-shaped fallback; it is no longer a scanned
 * bean.</p>
 */
public class LoggingAuditPersistence implements AuditPersistence {

    /** Dedicated audit logger (POC parity: {@code logger.child({ audit: true })}). */
    private static final Logger AUDIT_LOG = LoggerFactory.getLogger("audit");

    @Override
    public void persist(AuditRecord record) {
        AUDIT_LOG.atInfo()
                .addKeyValue("audit", true)
                .addKeyValue("action", record.action())
                .addKeyValue("entityType", record.entityType())
                .addKeyValue("entityId", record.entityId())
                .addKeyValue("actorId", record.actorId())
                .addKeyValue("metadata", record.metadata())
                .addKeyValue("createdAt", record.createdAt() == null ? null : record.createdAt().toString())
                .log("audit " + record.action());
    }
}
