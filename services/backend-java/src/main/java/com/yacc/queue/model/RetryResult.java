package com.yacc.queue.model;

import java.time.LocalDateTime;

/**
 * Retry outcome.
 *
 * @param success   always true on the 200 path
 * @param messageId retried message
 * @param message   confirmation text
 * @param timestamp payload timestamp
 */
public record RetryResult(boolean success, String messageId, String message,
        LocalDateTime timestamp) {
}
