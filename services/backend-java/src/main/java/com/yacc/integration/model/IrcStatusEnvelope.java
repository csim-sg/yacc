package com.yacc.integration.model;

/**
 * Status envelope {@code {data: IrcConnectionStatus}}.
 *
 * @param data connection status
 */
public record IrcStatusEnvelope(IrcConnectionStatus data) {
}
