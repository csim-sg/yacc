package com.yacc.common.controller;

/**
 * Integration-domain error with its frozen HTTP mapping and
 * {@code {code,message}} wire shape (contract component
 * {@code IntegrationErrorResponse}); rendered by {@link ApiExceptionHandler}.
 */
public class IntegrationApiException extends RuntimeException {

    private final String code;
    private final int status;

    public IntegrationApiException(String code, int status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public String code() {
        return code;
    }

    public int statusCode() {
        return status;
    }
}
