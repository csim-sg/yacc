package com.yacc.message.model;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Message status lookup (POC parity shape).
 *
 * @param messageId message UUID
 * @param status    lowercase wire status
 * @param createdAt creation timestamp
 * @param updatedAt last-update timestamp
 */
public record MessageStatusResponse(UUID messageId, String status, LocalDateTime createdAt,
        LocalDateTime updatedAt) {
}
