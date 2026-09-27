package com.yacc.conversation.model;

import java.util.List;

/**
 * One enriched list page.
 *
 * @param items page items
 * @param total matching conversations
 * @param page  1-indexed page
 * @param limit page size
 */
public record ConversationPage(List<ConversationListItem> items, long total, int page, int limit) {
}
