package com.yacc.integration.model;

/**
 * Test envelope {@code {data: {success,message}}} (sanitized).
 *
 * @param data sanitized test result
 */
public record IrcTestEnvelope(SanitizedResult data) {
}
