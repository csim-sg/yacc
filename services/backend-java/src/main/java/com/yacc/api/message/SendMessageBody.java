package com.yacc.api.message;

import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;
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
        // Contract SendMessageBody.attachmentIds: optional, non-nullable —
        // omitted when absent, never null (MIG-102).
        @JsonInclude(JsonInclude.Include.NON_NULL) List<UUID> attachmentIds) {
}
