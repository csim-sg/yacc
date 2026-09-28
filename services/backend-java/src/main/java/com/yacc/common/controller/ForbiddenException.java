package com.yacc.common.controller;

/**
 * Thrown by services for resource-level authorization denials beyond role
 * gates (e.g. self-modification guards, assignment checks). Rendered by
 * {@link ApiExceptionHandler} as the frozen 403 {@code {error}} shape.
 */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
