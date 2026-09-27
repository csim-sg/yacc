package com.yacc.notification.model;

import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.validation.constraints.NotNull;

/**
 * Read-flag body (frozen contract op {@code markNotificationRead}).
 *
 * @param isRead new read flag (must be a boolean)
 */
public record MarkNotificationReadRequest(@NotNull Boolean isRead) {
}
