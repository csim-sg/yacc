package com.yacc.auth.model;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Forgot-password request (MIG-031; frozen contract
 * {@code authForgotPassword}): {@code {email}}. The endpoint always answers
 * with the constant anti-enumeration message regardless of whether the
 * address is registered.
 *
 * @param email address a reset link is requested for
 */
public record ForgotPasswordRequest(
        @NotBlank @Email String email) {
}
