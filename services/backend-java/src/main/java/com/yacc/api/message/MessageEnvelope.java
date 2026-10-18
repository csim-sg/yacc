package com.yacc.api.message;

/**
 * Message envelope {@code {data: Message}} (frozen POST-send shape).
 *
 * @param data the message
 */
public record MessageEnvelope(MessageResponse data) {
}
