package com.yacc.conversation.model;

import com.yacc.conversation.model.ConversationStatus;

import jakarta.validation.constraints.NotNull;

/**
 * Status-update body (frozen contract op {@code updateConversationStatus}).
 *
 * @param status new conversation status
 */
public record UpdateStatusRequest(@NotNull ConversationStatus status) {
}
