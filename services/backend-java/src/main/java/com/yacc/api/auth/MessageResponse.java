package com.yacc.api.auth;

/**
 * Constant-message response (frozen contract {@code MessageResponse}); the
 * anti-enumeration body of forgot-password.
 *
 * @param message constant response text
 */
public record MessageResponse(String message) {
}
