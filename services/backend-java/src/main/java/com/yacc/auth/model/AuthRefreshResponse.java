package com.yacc.auth.model;

/**
 * Rotated token pair (MIG-030; frozen contract {@code AuthRefreshResponse}).
 *
 * @param accessToken  new stateless JWT access token
 * @param refreshToken new opaque refresh grant (the presented one is revoked)
 */
public record AuthRefreshResponse(String accessToken, String refreshToken) {
}
