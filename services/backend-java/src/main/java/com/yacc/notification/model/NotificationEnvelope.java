package com.yacc.notification.model;

/**
 * Single-notification envelope {@code {data: Notification}}.
 *
 * @param data the notification
 */
public record NotificationEnvelope(NotificationResponse data) {
}
