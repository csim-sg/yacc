package com.yacc.queue.model;

/**
 * One failure-reason count.
 *
 * @param reason failure reason
 * @param count  entries
 */
public record ReasonCount(String reason, long count) {
}
