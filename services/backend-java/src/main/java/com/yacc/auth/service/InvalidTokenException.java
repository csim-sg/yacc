package com.yacc.auth.service;

/**
 * A presented auth token is unknown, expired, or already consumed
 * (MIG-031). Rendered centrally as the generic anti-enumeration 400
 * {@code "Invalid or expired token"} by {@code ApiExceptionHandler} — the
 * same message for every failure reason, so token validity is not
 * enumerable (frozen contract {@code authResetPassword}; BE-003 parity).
 */
public class InvalidTokenException extends RuntimeException {

    public InvalidTokenException() {
        super("Invalid or expired token");
    }
}
