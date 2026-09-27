package com.yacc.auth.service;

/**
 * Outbound auth-email transport port (MIG-031; SPEC-002 integration table:
 * Email SMTP/SendGrid — send failure → retry + audit). Implementations are
 * plain transport adapters; retry, failure audit, and message composition
 * live in {@link AuthEmailService}. Tests never contact a real provider
 * (Mockito mock / MockRestServiceServer).
 */
public interface AuthEmailSender {

    /**
     * Delivers one text email. Implementations throw on transport failure;
     * they must never retry or audit themselves.
     *
     * @param to      recipient address
     * @param subject subject line
     * @param body    plain-text body
     */
    void send(String to, String subject, String body);
}
