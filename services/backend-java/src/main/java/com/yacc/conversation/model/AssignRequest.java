package com.yacc.conversation.model;

/**
 * Assignment body (frozen contract component {@code AssignBody}, ops
 * {@code assignConversationByPatch} and {@code bulkActionConversations}).
 * Null unassigns.
 *
 * @param assignedUserId assignee UUID, or null to unassign
 */
public record AssignRequest(String assignedUserId) {
}
