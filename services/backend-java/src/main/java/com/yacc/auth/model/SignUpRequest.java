package com.yacc.auth.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Self-registration request (MIG-030; frozen contract {@code authSignUpEmail}):
 * {@code {email, password, name}}. The request deliberately has NO role and
 * NO status field — the created identity is always {@code role: user}
 * (SPEC-002 FR-04/AC-11); a role sent by a client is unknown JSON and is
 * ignored, so self-elevation is impossible by construction. Validation
 * replaces the POC Zod {@code RegisterRequestSchema} (password min 8).
 *
 * @param email    account email (unique)
 * @param password password (minimum 8 characters)
 * @param name     display name
 */
public record SignUpRequest(
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8) String password,
        @NotBlank String name) {
}
