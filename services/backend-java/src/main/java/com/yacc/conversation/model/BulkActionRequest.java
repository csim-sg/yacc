package com.yacc.conversation.model;

import java.util.List;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Bulk-action body (frozen contract component {@code BulkActionRequest},
 * op {@code bulkActionConversations}): up to 100 conversation ids, one of
 * three actions, and an action payload ({@code assigneeId} for assign,
 * {@code tagId} for tag, {@code status} for status) — the payload is
 * action-specific and therefore validated in the service (JsonNode at the
 * documented JSON boundary; ledger row REST-BULK-001).
 *
 * @param conversationIds target conversations (1..100)
 * @param action assign | tag | status
 * @param data action payload (raw JSON at the documented boundary)
 */
public record BulkActionRequest(
        @NotEmpty @Size(max = 100) List<UUID> conversationIds,
        @NotNull String action,
        @NotNull JsonNode data) {
}
