package com.yacc.api.message;

import com.yacc.entity.Message;
import java.util.List;

/**
 * One message page (frozen custom shape).
 *
 * @param messages page items
 * @param total    all messages of the conversation
 * @param page     1-indexed page
 * @param limit    page size
 */
public record MessagePage(List<Message> messages, long total, int page, int limit) {
}
