package com.yacc.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.auth.AuthProperties;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * Unit tests for auth-email delivery (MIG-031; SPEC-002 integration
 * contract "Send failure → retry + audit"): retry until success, and the
 * {@code email.send_failed} audit event after exhausting attempts — with
 * no secret material and no token values in audit metadata.
 */
@ExtendWith(MockitoExtension.class)
class AuthEmailServiceTest {

    @Mock
    private AuthEmailSender sender;

    @Mock
    private AuditPersistence audit;

    @Captor
    private ArgumentCaptor<AuditRecord> auditCaptor;

    private AuthEmailService service;

    @BeforeEach
    void setUp() {
        AuthProperties properties = new AuthProperties(null, null, null,
                new AuthProperties.Email("no-reply@fixture.yacc.local", "smtp", null,
                        "http://frontend.fixture.yacc.local", 3,
                        java.time.Duration.ofNanos(1)),
                null, null);
        service = new AuthEmailService(sender, properties, audit);
    }

    @Test
    void sendsOnTheFirstAttemptWithoutAudit() {
        service.sendPasswordResetEmail("user@fixture.yacc.local", "a".repeat(64));

        verify(sender, times(1)).send(any(), any(), any());
        verify(audit, org.mockito.Mockito.never()).persist(any());
    }

    @Test
    void retriesUntilSuccessAndNeverAuditsFailure() {
        doThrow(new IllegalStateException("smtp down"))
                .doThrow(new IllegalStateException("smtp still down"))
                .doNothing()
                .when(sender)
                .send(any(), any(), any());

        service.sendVerificationEmail("user@fixture.yacc.local", "b".repeat(64));

        verify(sender, times(3)).send(any(), any(), any());
        verify(audit, org.mockito.Mockito.never()).persist(any());
    }

    @Test
    void auditsFailureAfterExhaustingAttempts() {
        doThrow(new IllegalStateException("smtp down")).when(sender)
                .send(any(), any(), any());

        service.sendPasswordResetEmail("user@fixture.yacc.local", "c".repeat(64));

        verify(sender, times(3)).send(any(), any(), any());
        verify(audit).persist(auditCaptor.capture());
        AuditRecord record = auditCaptor.getValue();
        assertThat(record.action()).isEqualTo("email.send_failed");
        ObjectNode metadata = (ObjectNode) record.metadata();
        assertThat(metadata.get("recipient").asText()).isEqualTo("user@fixture.yacc.local");
        assertThat(metadata.get("attempts").asInt()).isEqualTo(3);
        // No secret material in the audit trail: the body carries the
        // action-link token, so only recipient/subject are ever recorded.
        assertThat(record.toString()).doesNotContain("c".repeat(64));
        assertThat(record.toString()).doesNotContain("api-key");
    }

    @Test
    void resetEmailBodiesCarryTheActionLink() {
        service.sendPasswordResetEmail("user@fixture.yacc.local", "d".repeat(64));

        org.mockito.Mockito.verify(sender).send(
                org.mockito.ArgumentMatchers.eq("user@fixture.yacc.local"),
                org.mockito.ArgumentMatchers.eq("Reset your YACC password"),
                org.mockito.ArgumentMatchers.contains(
                        "http://frontend.fixture.yacc.local/reset-password?token="
                                + "d".repeat(64)));
    }

    @Test
    void verificationEmailBodiesCarryTheActionLink() {
        service.sendVerificationEmail("user@fixture.yacc.local", "e".repeat(64));

        org.mockito.Mockito.verify(sender).send(
                org.mockito.ArgumentMatchers.eq("user@fixture.yacc.local"),
                org.mockito.ArgumentMatchers.eq("Verify your YACC email"),
                org.mockito.ArgumentMatchers.contains(
                        "http://frontend.fixture.yacc.local/verify-email?token="
                                + "e".repeat(64)));
    }

    @Test
    void auditRecordShapeStaysPocParity() {
        doThrow(new IllegalStateException("smtp down")).when(sender)
                .send(any(), any(), any());

        service.sendPasswordResetEmail("user@fixture.yacc.local", "f".repeat(64));

        verify(audit).persist(auditCaptor.capture());
        AuditRecord record = auditCaptor.getValue();
        Instant createdAt = record.createdAt();
        assertThat(record.entityType()).isEqualTo("user");
        assertThat(createdAt).isNotNull();
    }
}
