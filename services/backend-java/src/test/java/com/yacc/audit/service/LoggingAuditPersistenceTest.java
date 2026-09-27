package com.yacc.audit.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.slf4j.event.KeyValuePair;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.audit.model.AuditRecord;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;

/**
 * Verifies the structured audit log field shape (POC {@code auditLogger}
 * parity): top-level {@code audit: true} plus the audit fields, and the MDC
 * correlation id visible on request-scoped records.
 */
class LoggingAuditPersistenceTest {

    private final Logger auditLogger = (Logger) LoggerFactory.getLogger("audit");
    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    private final LoggingAuditPersistence persistence = new LoggingAuditPersistence();

    @BeforeEach
    void attachAppender() {
        appender.start();
        auditLogger.addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        auditLogger.detachAppender(appender);
        MDC.clear();
    }

    @Test
    void logsAuditRecordWithPocFieldShape() {
        AuditRecord record = new AuditRecord(
                "AuthenticationSuccessEvent", "user", "user-1", "user-1",
                new ObjectMapper().createObjectNode(), Instant.parse("2026-09-27T00:00:00Z"));

        persistence.persist(record);

        assertThat(appender.list).hasSize(1);
        ILoggingEvent event = appender.list.get(0);
        assertThat(event.getLevel()).isEqualTo(Level.INFO);
        assertThat(event.getFormattedMessage()).isEqualTo("audit AuthenticationSuccessEvent");

        List<KeyValuePair> pairs = event.getKeyValuePairs();
        assertThat(pairs).isNotNull();
        assertThat(pairs).contains(new KeyValuePair("audit", true));
        assertThat(pairs).contains(new KeyValuePair("action", "AuthenticationSuccessEvent"));
        assertThat(pairs).contains(new KeyValuePair("actorId", "user-1"));
        assertThat(pairs).contains(new KeyValuePair("createdAt", "2026-09-27T00:00:00Z"));
    }

    @Test
    void requestScopedRecordCarriesCorrelationId() {
        AuditRecord record = new AuditRecord(
                "AuthenticationFailureBadCredentialsEvent", "user", "user-2", "user-2",
                new ObjectMapper().createObjectNode(), Instant.now());
        MDC.put("correlationId", "corr-7");

        persistence.persist(record);

        ILoggingEvent event = appender.list.get(0);
        assertThat(event.getMDCPropertyMap()).containsEntry("correlationId", "corr-7");
    }
}
