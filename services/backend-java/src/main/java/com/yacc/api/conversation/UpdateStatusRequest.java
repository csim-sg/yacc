package com.yacc.api.conversation;

import com.yacc.entity.ConversationStatus;

import jakarta.validation.constraints.NotNull;

/**
 * Status-update body (frozen contract op {@code updateConversationStatus}).
 *
 * @param status new conversation status
 */
public record UpdateStatusRequest(@NotNull ConversationStatus status) {
}
