package com.yacc.message.model;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Send-message body (frozen contract component {@code SendMessageBody}).
 *
 * @param body          message text (1..10000)
 * @param attachmentIds optional attachment references (Phase 6 storage)
 */
public record SendMessageBody(
        @NotBlank @Size(min = 1, max = 10000) String body,
        List<UUID> attachmentIds) {
}
