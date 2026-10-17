package com.yacc.api.notification;

/**
 * Single-notification envelope {@code {data: Notification}}.
 *
 * @param data the notification
 */
public record NotificationEnvelope(NotificationResponse data) {
}
