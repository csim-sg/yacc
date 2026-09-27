package com.yacc.auth.model;

/**
 * Success-acknowledgment response (frozen contract
 * {@code SuccessMessageResponse}); body of reset-password and the
 * email-verification confirmation.
 *
 * @param success always {@code true} on the 2xx path
 * @param message human-readable confirmation
 */
public record SuccessMessageResponse(boolean success, String message) {
}
