package com.yacc.conversation.model;

import java.util.List;

/**
 * Best-effort bulk-action outcome (frozen contract component
 * {@code BulkActionResponseData}).
 *
 * @param successCount conversations changed
 * @param failureCount conversations failed
 * @param failures per-item failure reasons
 */
public record BulkActionResponseData(int successCount, int failureCount, List<BulkActionFailure> failures) {
}
