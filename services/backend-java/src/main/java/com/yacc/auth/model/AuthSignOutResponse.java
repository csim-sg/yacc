package com.yacc.auth.model;

/**
 * Sign-out response (MIG-030; frozen contract {@code AuthSignOutResponse}):
 * with stateless JWT access tokens the sign-out revokes the refresh grant;
 * the presented access token simply expires (ADR-025).
 *
 * @param success always {@code true} (idempotent)
 */
public record AuthSignOutResponse(boolean success) {
}
