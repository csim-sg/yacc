package com.yacc.auth.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Sign-in request (MIG-030; frozen contract {@code authSignInEmail}):
 * {@code {email, password}}. Validation replaces the POC Zod
 * {@code LoginRequestSchema} (email format, required fields).
 *
 * @param email    account email
 * @param password account password (checked against the bcrypt hash)
 */
public record SignInRequest(
        @NotBlank @Email String email,
        @NotBlank String password) {
}
