package com.yacc.audit.service;

import java.time.Instant;

import org.springframework.context.event.EventListener;
import org.springframework.security.authentication.event.AbstractAuthenticationEvent;
import org.springframework.security.authentication.event.AbstractAuthenticationFailureEvent;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.audit.model.AuditRecord;

/**
 * Consumes published Spring Security events and funnels them into the audit
 * pipeline (SPEC-002 TR-07; ADR-029 "audit via Spring Security events"; ledger
 * REST-CONV-003 "audit event parity via Spring Security events + audit table").
 *
 * <p>MIG-030 applies the POC action vocabulary to the authentication event
 * families the local auth flows emit: sign-in success
 * ({@code user.login}) and failure ({@code user.login.failed}); other
 * security events keep their event-class action name. Auth lifecycle events
 * beyond sign-in (registration, bootstrap, recovery, credential change) are
 * persisted directly by the auth services through the same
 * {@link AuditPersistence} hook.</p>
 */
@Component
public class SecurityAuditEventListener {

    /** POC vocabulary action for a successful sign-in. */
    private static final String ACTION_LOGIN = "user.login";

    /** POC vocabulary action for a failed sign-in. */
    private static final String ACTION_LOGIN_FAILED = "user.login.failed";

    private final AuditPersistence persistence;

    private final ObjectMapper mapper;

    /** Constructor injection only (guardrails 004 §2; ADR-024; ADR-030). */
    public SecurityAuditEventListener(AuditPersistence persistence, ObjectMapper mapper) {
        this.persistence = persistence;
        this.mapper = mapper;
    }

    /**
     * Persists every Spring Security authentication event (success and failure
     * subclasses alike) as an audit record. The interactive-login twin event
     * ({@code InteractiveAuthenticationSuccessEvent}, published by the login
     * filter) is skipped: for interactive flows — local sign-in publishes its
     * own event, and the OIDC relying party (MIG-032) already yields the
     * {@code user.login} record through the provider manager's
     * {@code AuthenticationSuccessEvent} — persisting the twin would
     * double-count one sign-in.
     *
     * @param event the published security event
     */
    @EventListener(AbstractAuthenticationEvent.class)
    public void onAuthenticationEvent(AbstractAuthenticationEvent event) {
        if (event instanceof org.springframework.security.authentication.event.InteractiveAuthenticationSuccessEvent) {
            return;
        }
        ObjectNode metadata = mapper.createObjectNode();
        if (event instanceof AbstractAuthenticationFailureEvent failure) {
            metadata.put("exception", failure.getException().getClass().getSimpleName());
            metadata.put("message", failure.getException().getMessage());
        }
        String principalName = principalName(event);
        persistence.persist(new AuditRecord(
                actionOf(event),
                "user",
                principalName,
                principalName,
                metadata,
                Instant.now()));
    }

    private static String actionOf(AbstractAuthenticationEvent event) {
        if (event instanceof org.springframework.security.authentication.event.AuthenticationSuccessEvent) {
            return ACTION_LOGIN;
        }
        if (event instanceof org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent) {
            return ACTION_LOGIN_FAILED;
        }
        return event.getClass().getSimpleName();
    }

    private String principalName(AbstractAuthenticationEvent event) {
        Authentication authentication = event.getAuthentication();
        return authentication == null ? null : authentication.getName();
    }
}
