package com.yacc.api.conversation;

import com.yacc.entity.ConversationPriority;

import jakarta.validation.constraints.NotNull;

/**
 * Priority-update body (frozen contract op {@code updateConversationPriority}).
 *
 * @param priority new conversation priority
 */
public record UpdatePriorityRequest(@NotNull ConversationPriority priority) {
}
