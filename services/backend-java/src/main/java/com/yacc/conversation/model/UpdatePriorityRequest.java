package com.yacc.conversation.model;

import com.yacc.conversation.model.ConversationPriority;

import jakarta.validation.constraints.NotNull;

/**
 * Priority-update body (frozen contract op {@code updateConversationPriority}).
 *
 * @param priority new conversation priority
 */
public record UpdatePriorityRequest(@NotNull ConversationPriority priority) {
}
