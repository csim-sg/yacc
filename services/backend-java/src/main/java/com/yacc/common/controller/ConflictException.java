package com.yacc.common.controller;

/**
 * Thrown by services when a uniqueness constraint is violated (e.g. an
 * already-registered email). Rendered by {@link ApiExceptionHandler} as the
 * frozen 409 {@code {error}} shape.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
