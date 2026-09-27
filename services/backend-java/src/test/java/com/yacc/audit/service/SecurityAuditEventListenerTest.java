package com.yacc.audit.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.security.authentication.event.AuthenticationSuccessEvent;
import org.springframework.security.core.AuthenticationException;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.audit.model.AuditRecord;

/**
 * Tests the Spring Security event → audit pipeline (SPEC-002 TR-07; ledger
 * REST-XSRV-004 audit evidence). MIG-030: sign-in events carry the POC
 * action vocabulary ({@code user.login} / {@code user.login.failed}); other
 * security events keep their event-class action name.
 */
class SecurityAuditEventListenerTest {

    private final CapturingAuditPersistence persistence = new CapturingAuditPersistence();
    private final SecurityAuditEventListener listener =
            new SecurityAuditEventListener(persistence, new ObjectMapper());

    @Test
    void persistsSuccessEventWithLoginVocabulary() {
        AuthenticationSuccessEvent event =
                new AuthenticationSuccessEvent(new TestingAuthenticationToken("user-1", "n/a", "ROLE_USER"));

        listener.onAuthenticationEvent(event);

        assertThat(persistence.records).hasSize(1);
        AuditRecord record = persistence.records.get(0);
        assertThat(record.action()).isEqualTo("user.login");
        assertThat(record.entityType()).isEqualTo("user");
        assertThat(record.actorId()).isEqualTo("user-1");
        assertThat(record.createdAt()).isNotNull();
        assertThat(record.metadata()).isNotNull();
    }

    @Test
    void persistsFailureEventWithLoginFailedVocabulary() {
        TestingAuthenticationToken authentication = new TestingAuthenticationToken("user-2", "bad", "ROLE_USER");
        AuthenticationException exception = new BadCredentialsException("nope");
        AuthenticationFailureBadCredentialsEvent event =
                new AuthenticationFailureBadCredentialsEvent(authentication, exception);

        listener.onAuthenticationEvent(event);

        assertThat(persistence.records).hasSize(1);
        AuditRecord record = persistence.records.get(0);
        assertThat(record.action()).isEqualTo("user.login.failed");
        assertThat(record.actorId()).isEqualTo("user-2");
        JsonNode metadata = record.metadata();
        assertThat(metadata.get("exception").asText()).isEqualTo("BadCredentialsException");
        assertThat(metadata.get("message").asText()).isEqualTo("nope");
    }

    /** Test double capturing persisted records (no DB in MIG-011 scope). */
    private static final class CapturingAuditPersistence implements AuditPersistence {
        private final List<AuditRecord> records = new ArrayList<>();

        @Override
        public void persist(AuditRecord record) {
            records.add(record);
        }
    }
}
