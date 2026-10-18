package com.yacc.api.integration;

/**
 * Saved-config envelope {@code {data: {...}}}.
 *
 * @param data sanitized saved config
 */
public record IrcConfigEnvelope(IrcConfigResponse data) {
}
