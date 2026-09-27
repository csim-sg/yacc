package com.yacc.auth.model;

import jakarta.validation.constraints.NotBlank;

/**
 * Refresh-grant request (MIG-030; frozen contract {@code authRefreshToken}):
 * {@code {refreshToken}}. The presented grant is rotated: a new grant is
 * issued and the presented one is revoked (ADR-025 stateless JWT access +
 * refresh default).
 *
 * @param refreshToken the opaque refresh grant
 */
public record RefreshTokenRequest(@NotBlank String refreshToken) {
}
