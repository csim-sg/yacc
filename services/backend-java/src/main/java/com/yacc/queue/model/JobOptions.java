package com.yacc.queue.model;

/**
 * Job retry options subset.
 *
 * @param attempts configured attempts
 * @param backoff  backoff strategy label
 */
public record JobOptions(Integer attempts, String backoff) {
}
