package com.yacc.common.model;

/**
 * Frozen error wire shape: {@code {error: string}}.
 *
 * @param error human-readable error message
 */
public record ErrorResponse(String error) {
}
