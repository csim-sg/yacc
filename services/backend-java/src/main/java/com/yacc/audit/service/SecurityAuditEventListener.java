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
 * <p>Action names are currently the Spring Security event class names (e.g.
 * {@code AuthenticationSuccessEvent}); the POC action vocabulary
 * ({@code user.login.failed} etc.) is applied when the auth flows land in
 * MIG-030 and emit audit events through the same persistence hook. Authorization
 * events follow in MIG-030 together with the security filter chain that raises
 * them; MIG-011 delivers the consumable seam.</p>
 */
@Component
public class SecurityAuditEventListener {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final AuditPersistence persistence;

    /** Constructor injection only (guardrails 004 §2). */
    public SecurityAuditEventListener(AuditPersistence persistence) {
        this.persistence = persistence;
    }

    /**
     * Persists every Spring Security authentication event (success and failure
     * subclasses alike) as an audit record.
     *
     * @param event the published security event
     */
    @EventListener(AbstractAuthenticationEvent.class)
    public void onAuthenticationEvent(AbstractAuthenticationEvent event) {
        ObjectNode metadata = MAPPER.createObjectNode();
        if (event instanceof AbstractAuthenticationFailureEvent failure) {
            metadata.put("exception", failure.getException().getClass().getSimpleName());
            metadata.put("message", failure.getException().getMessage());
        }
        String principalName = principalName(event);
        persistence.persist(new AuditRecord(
                event.getClass().getSimpleName(),
                "user",
                principalName,
                principalName,
                metadata,
                Instant.now()));
    }

    private String principalName(AbstractAuthenticationEvent event) {
        Authentication authentication = event.getAuthentication();
        return authentication == null ? null : authentication.getName();
    }
}
