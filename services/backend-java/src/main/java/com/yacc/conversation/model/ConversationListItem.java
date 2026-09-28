package com.yacc.conversation.model;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Conversation list item (frozen contract component {@code Conversation},
 * enriched with the POC list-shape fields: assignee name, tags,
 * participants, unread count, and latest-message preview).
 */
public record ConversationListItem(
        String id,
        String channel,
        String externalThreadId,
        String status,
        String priority,
        String assignedUserId,
        String assignedUserName,
        List<TagRef> tags,
        List<Participant> participants,
        long unreadCount,
        String latestMessagePreview,
        LocalDateTime latestMessageAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
