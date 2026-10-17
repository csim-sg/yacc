package com.yacc.api.integration;

/**
 * Sanitized test result.
 *
 * @param success connection established
 * @param message human-readable outcome
 */
public record SanitizedResult(boolean success, String message) {
}
