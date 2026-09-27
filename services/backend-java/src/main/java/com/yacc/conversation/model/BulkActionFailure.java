package com.yacc.conversation.model;

/**
 * One bulk-action item failure (frozen contract component
 * {@code BulkActionResponseData.failures[]}).
 *
 * @param id failed conversation id
 * @param reason safe failure reason (never internal error text)
 */
public record BulkActionFailure(String id, String reason) {
}
