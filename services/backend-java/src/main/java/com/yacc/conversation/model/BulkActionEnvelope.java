package com.yacc.conversation.model;

/**
 * Bulk-result envelope {@code {data: BulkActionResponseData}}.
 *
 * @param data best-effort outcome
 */
public record BulkActionEnvelope(BulkActionResponseData data) {
}
