package com.yacc.integration.model;

/**
 * Sanitized test result.
 *
 * @param success connection established
 * @param message human-readable outcome
 */
public record SanitizedResult(boolean success, String message) {
}
