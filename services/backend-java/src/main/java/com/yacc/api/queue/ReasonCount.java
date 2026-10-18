package com.yacc.api.queue;

/**
 * One failure-reason count.
 *
 * @param reason failure reason
 * @param count  entries
 */
public record ReasonCount(String reason, long count) {
}
