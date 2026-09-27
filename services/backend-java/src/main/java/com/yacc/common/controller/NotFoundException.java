package com.yacc.common.controller;

/**
 * Thrown by services when a referenced resource does not exist. Rendered by
 * {@link ApiExceptionHandler} as the frozen 404 {@code {error}} shape.
 */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
