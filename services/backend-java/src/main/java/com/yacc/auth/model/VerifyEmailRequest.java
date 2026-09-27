package com.yacc.auth.model;

import jakarta.validation.constraints.NotBlank;

/**
 * Email-verification request (MIG-031; contract deviation recorded in
 * {@code openapi.yaml} — {@code POST /api/auth/verify-email}): the raw
 * verification token delivered by the sign-up email.
 *
 * @param token raw verification token from the email link
 */
public record VerifyEmailRequest(
        @NotBlank String token) {
}
