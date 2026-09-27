package com.yacc.common.controller;

/**
 * Thrown by services when an operation fails unexpectedly despite valid
 * input (e.g. a delete that no longer exists). Rendered by
 * {@link ApiExceptionHandler} as the frozen 500 {@code {error}} shape.
 */
public class InternalServerErrorException extends RuntimeException {

    public InternalServerErrorException(String message) {
        super(message);
    }
}
