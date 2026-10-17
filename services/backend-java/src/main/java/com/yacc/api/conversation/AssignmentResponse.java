package com.yacc.api.conversation;

/**
 * Assignment result (frozen contract component {@code AssignmentResponse},
 * POC {@code assignments.types} shape).
 */
public record AssignmentResponse(
        String id,
        String conversationId,
        String previouslyAssignedUserId,
        String newlyAssignedUserId,
        String assignedAt) {
}
