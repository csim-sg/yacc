package com.yacc.common.controller;

/**
 * Thrown by services when a request violates validation rules that bean
 * validation cannot express (semantic checks such as pagination bounds or
 * enum filters). Rendered by {@link ApiExceptionHandler} as the frozen 400
 * {@code {error}} shape (MIG-003 wire contract).
 */
public class BadRequestException extends RuntimeException {

    public BadRequestException(String message) {
        super(message);
    }
}
