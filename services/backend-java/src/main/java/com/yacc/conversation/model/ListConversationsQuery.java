package com.yacc.conversation.model;

import com.yacc.conversation.model.ConversationStatus;
import com.yacc.conversation.model.ConversationPriority;

/**
 * Conversation list filters (frozen contract op {@code listConversations};
 * 13 query parameters, POC validation parity enforced in the service).
 *
 * @param page 1-indexed page, null → 1
 * @param limit page size (≤100), null → 20
 * @param channel channel label (telegram/irc), validated
 * @param status conversation status filter
 * @param priority conversation priority filter
 * @param assignedUserId assignee filter
 * @param tagId positive tag id filter
 * @param search free-text search across title/thread/messages
 * @param dateFrom ISO date lower bound on last activity
 * @param dateTo ISO date upper bound on last activity
 * @param unread literal "true" enables the inbound/unread filter
 * @param sortBy sort key (lastActivity/created/priority), default lastActivity
 * @param sortOrder asc/desc, default desc
 */
public record ListConversationsQuery(
        Integer page,
        Integer limit,
        String channel,
        ConversationStatus status,
        ConversationPriority priority,
        String assignedUserId,
        Integer tagId,
        String search,
        String dateFrom,
        String dateTo,
        boolean unread,
        String sortBy,
        String sortOrder) {
}
