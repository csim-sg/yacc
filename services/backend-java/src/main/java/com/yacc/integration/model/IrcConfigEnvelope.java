package com.yacc.integration.model;

/**
 * Saved-config envelope {@code {data: {...}}}.
 *
 * @param data sanitized saved config
 */
public record IrcConfigEnvelope(IrcConfigResponse data) {
}
