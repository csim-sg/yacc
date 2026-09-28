package com.yacc.conversation.model;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Single conversation (frozen contract component {@code Conversation},
 * POC detail shape: id/channel/thread/status/priority/assignment plus tags
 * and participants).
 */
public record ConversationDetail(
        String id,
        String channel,
        String externalThreadId,
        String status,
        String priority,
        String assignedUserId,
        List<TagRef> tags,
        List<Participant> participants,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
