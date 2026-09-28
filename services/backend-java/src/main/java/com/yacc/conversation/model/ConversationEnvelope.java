package com.yacc.conversation.model;

/**
 * Single-result envelope {@code {data: <conversation>}} (frozen contract
 * convention).
 *
 * @param data the conversation
 */
public record ConversationEnvelope(ConversationDetail data) {
}
