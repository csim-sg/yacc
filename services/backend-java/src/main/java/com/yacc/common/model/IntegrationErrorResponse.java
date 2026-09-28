package com.yacc.common.model;

/**
 * IRC-integration error shape (frozen contract component
 * {@code IntegrationErrorResponse}): {@code {code, message}} with the
 * frozen code vocabulary validation_error, encryption_key_missing,
 * irc_not_configured, internal_error.
 *
 * @param code machine-readable error code
 * @param message human-readable message
 */
public record IntegrationErrorResponse(String code, String message) {

    /** Frozen code: request validation failure (400). */
    public static final String VALIDATION_ERROR = "validation_error";

    /** Frozen code: credential master key not configured (400). */
    public static final String ENCRYPTION_KEY_MISSING = "encryption_key_missing";

    /** Frozen code: IRC not configured (409). */
    public static final String IRC_NOT_CONFIGURED = "irc_not_configured";

    /** Frozen code: unexpected failure (500). */
    public static final String INTERNAL_ERROR = "internal_error";
}
