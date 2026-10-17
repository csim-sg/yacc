package com.yacc.api.conversation;

/**
 * Single-result envelope {@code {data: <conversation>}} (frozen contract
 * convention).
 *
 * @param data the conversation
 */
public record ConversationEnvelope(ConversationDetail data) {
}
