package com.yacc.conversation.model;

import jakarta.validation.constraints.NotBlank;

/**
 * Assignment body (frozen contract op {@code assignConversationByPost}).
 *
 * @param assignedUserId target assignee
 */
public record AssignBody(@NotBlank String assignedUserId) {
}
