package com.yacc.api.integration;

/**
 * Test envelope {@code {data: {success,message}}} (sanitized).
 *
 * @param data sanitized test result
 */
public record IrcTestEnvelope(SanitizedResult data) {
}
