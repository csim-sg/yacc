package com.yacc.queue.model;

import java.time.LocalDateTime;

/**
 * Clear outcome (POC parity shape).
 *
 * @param success   always true on the 200 path
 * @param messageId cleared message
 * @param message   confirmation text
 * @param timestamp payload timestamp
 */
public record ClearResponse(boolean success, String messageId, String message,
        LocalDateTime timestamp) {
}
