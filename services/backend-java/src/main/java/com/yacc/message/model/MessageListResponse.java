package com.yacc.message.model;

import java.util.List;
import java.util.UUID;

/**
 * The frozen custom message-list shape (contract component
 * {@code MessageListResponse} — deliberately NOT BaseListResponse).
 *
 * @param messages page items
 * @param total    all messages of the conversation
 * @param page     1-indexed page
 * @param limit    page size
 */
public record MessageListResponse(List<MessageResponse> messages, long total, int page,
        int limit) {
}
