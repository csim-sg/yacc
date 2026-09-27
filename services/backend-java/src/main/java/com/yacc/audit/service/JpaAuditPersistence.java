package com.yacc.audit.service;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.audit.model.AuditLog;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.repository.AuditLogRepository;

/**
 * JPA-backed {@link AuditPersistence}: writes audit records into the
 * {@code audit_logs} table (POC {@code auditService.logAction} parity; the
 * replacement this interface's interim implementation documented when the
 * table landed in MIG-020/021). Audit failures never break the caller —
 * failures are logged, not rethrown.
 *
 * <p>The {@code entity_id} column is a PostgreSQL {@code uuid}; records with
 * non-UUID entity ids (baseline rows like {@code users.list} used the literal
 * {@code 'list'}) cannot be stored and are dropped with a warning — exact
 * baseline behavior, where such inserts failed and were swallowed.</p>
 */
@Component
public class JpaAuditPersistence implements AuditPersistence {

    private static final Logger LOG = LoggerFactory.getLogger(JpaAuditPersistence.class);

    private final AuditLogRepository auditLogs;
    private final ObjectMapper mapper;

    public JpaAuditPersistence(AuditLogRepository auditLogs, ObjectMapper mapper) {
        this.auditLogs = auditLogs;
        this.mapper = mapper;
    }

    @Override
    @Transactional
    public void persist(AuditRecord record) {
        UUID entityId = parseEntityId(record.entityId());
        if (entityId == null) {
            LOG.warn("Dropping audit record with non-UUID entityId: action={}, entityType={}, entityId={}",
                    record.action(), record.entityType(), record.entityId());
            return;
        }
        try {
            AuditLog entry = new AuditLog(UUID.randomUUID(), record.actorId(), record.action(),
                    record.entityType(), entityId, null);
            entry.setMetadata(writeJson(record.metadata()));
            auditLogs.save(entry);
        } catch (RuntimeException failure) {
            LOG.warn("Failed to persist audit record: action={}, entityType={}, error={}",
                    record.action(), record.entityType(), failure.getMessage());
        }
    }

    private UUID parseEntityId(String entityId) {
        try {
            return UUID.fromString(entityId);
        } catch (IllegalArgumentException | NullPointerException failure) {
            return null;
        }
    }

    private String writeJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return mapper.writeValueAsString(value);
        } catch (JsonProcessingException failure) {
            return null;
        }
    }
}
