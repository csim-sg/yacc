package com.yacc.api.integration;

/**
 * Status envelope {@code {data: IrcConnectionStatus}}.
 *
 * @param data connection status
 */
public record IrcStatusEnvelope(IrcConnectionStatus data) {
}
