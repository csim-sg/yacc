package com.yacc.notification.model;

import java.util.List;

/**
 * One own-scope page.
 *
 * @param items page items
 * @param total all notifications of the user
 * @param page  1-indexed page
 * @param limit page size
 */
public record NotificationPage(List<Notification> items, long total, int page, int limit) {
}
