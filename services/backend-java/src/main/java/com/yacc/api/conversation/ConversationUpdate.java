package com.yacc.api.conversation;

/**
 * Mutation outcome.
 *
 * @param conversation enriched conversation after the change
 * @param oldValue     previous status/priority/assignee (audit parity)
 */
public record ConversationUpdate(ConversationDetail conversation, String oldValue) {
}
