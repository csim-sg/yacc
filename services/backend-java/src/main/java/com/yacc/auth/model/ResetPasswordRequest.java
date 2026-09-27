package com.yacc.auth.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Password-reset request (MIG-031; frozen contract
 * {@code authResetPassword}): {@code {token, password}}. The token is the
 * raw 64-character hex value delivered by email; the replacement credential
 * follows the MIG-030 password policy (minimum 8 characters).
 *
 * @param token    raw reset token from the email link
 * @param password replacement credential (minimum 8 characters)
 */
public record ResetPasswordRequest(
        @NotBlank String token,
        @NotBlank @Size(min = 8) String password) {
}
