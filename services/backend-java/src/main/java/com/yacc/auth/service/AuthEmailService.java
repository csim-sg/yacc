package com.yacc.auth.service;

import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.auth.AuthProperties;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * Auth-email delivery with retry + audit (MIG-031; SPEC-002 integration
 * contract: send failure → retry + audit). Message composition lives here;
 * transport lives behind {@link AuthEmailSender}. Delivery is best-effort
 * from the caller's perspective: after exhausting the configured attempts
 * the failure is audit-logged ({@code email.send_failed}) and the caller
 * proceeds — forgot-password keeps its constant 200 answer and sign-up is
 * never broken by a mail outage.
 *
 * <p>No secret material and no token values are ever written to logs or
 * audit metadata — only recipient and subject.</p>
 */
@Service
public class AuthEmailService {

    private static final Logger LOG = LoggerFactory.getLogger(AuthEmailService.class);

    private final AuthEmailSender sender;
    private final AuthProperties properties;
    private final AuditPersistence audit;

    public AuthEmailService(AuthEmailSender sender, AuthProperties properties,
            AuditPersistence audit) {
        this.sender = sender;
        this.properties = properties;
        this.audit = audit;
    }

    /**
     * Sends the password-reset email (action link carrying the raw token).
     *
     * @param to    recipient address
     * @param token raw single-use reset token (embedded in the link only)
     */
    public void sendPasswordResetEmail(String to, String token) {
        String link = properties.email().baseUrl()
                + "/reset-password?token=" + token;
        deliver(to, "Reset your YACC password", """
                A password reset was requested for your YACC account.

                Open the link below to choose a new password (the link \
                expires and can be used once):
                %s

                If you did not request this, ignore this email.
                """.formatted(link));
    }

    /**
     * Sends the email-verification email (action link carrying the raw
     * token).
     *
     * @param to    recipient address
     * @param token raw single-use verification token (embedded in the link)
     */
    public void sendVerificationEmail(String to, String token) {
        String link = properties.email().baseUrl()
                + "/verify-email?token=" + token;
        deliver(to, "Verify your YACC email", """
                Welcome to YACC.

                Confirm this address with the link below (the link \
                expires and can be used once):
                %s
                """.formatted(link));
    }

    private void deliver(String to, String subject, String body) {
        int maxAttempts = properties.email().maxSendAttempts();
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                sender.send(to, subject, body);
                LOG.info("Auth email delivered — recipient: {}, subject: {}, attempt: {}",
                        to, subject, attempt);
                return;
            } catch (Exception failure) {
                LOG.warn("Auth email send attempt {}/{} failed — recipient: {}, subject: {}, error: {}",
                        attempt, maxAttempts, to, subject, failure.getMessage());
                if (attempt < maxAttempts) {
                    sleepBeforeRetry();
                }
            }
        }
        auditFailedDelivery(to, subject, maxAttempts);
    }

    private void sleepBeforeRetry() {
        try {
            Thread.sleep(properties.email().retryBackoff().toMillis());
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Auth email retry interrupted", interrupted);
        }
    }

    private void auditFailedDelivery(String to, String subject, int attempts) {
        ObjectNode metadata = JsonNodeFactory.instance.objectNode();
        metadata.put("recipient", to);
        metadata.put("subject", subject);
        metadata.put("attempts", attempts);
        audit.persist(new AuditRecord("email.send_failed", "user", null, null,
                metadata, Instant.now()));
    }
}
