package com.yacc.common.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import com.yacc.auth.service.EmailAlreadyRegisteredException;
import com.yacc.auth.service.InvalidTokenException;

/**
 * Centralized REST error contract (ARCH-004 §5): every error response uses
 * the frozen wire shape {@code {error: string}} (POC routing-controllers
 * parity). Controllers never shape errors themselves; security filter-level
 * denials are rendered by the auth entry point / access-denied handler with
 * the same shape.
 *
 * <p>Placement: {@code common} — the one cross-cutting web error surface
 * shared by every feature controller (ADR-030 §4).</p>
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    /** Bean-validation failure on a request body (Zod parity). */
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<ErrorResponse> validationFailure(Exception exception) {
        return respond(HttpStatus.BAD_REQUEST, "Validation error");
    }

    /** Duplicate self-registration email — generic, anti-enumeration. */
    @ExceptionHandler(EmailAlreadyRegisteredException.class)
    public ResponseEntity<ErrorResponse> duplicateEmail(EmailAlreadyRegisteredException exception) {
        return respond(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    /**
     * Unknown/expired/consumed auth token (MIG-031 reset + verification) —
     * one generic message for every reason, anti-enumeration.
     */
    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<ErrorResponse> invalidToken(InvalidTokenException exception) {
        return respond(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    /** Failed authentication: bad credentials, non-active identity at sign-in. */
    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> badCredentials(BadCredentialsException exception) {
        return respond(HttpStatus.UNAUTHORIZED, exception.getMessage());
    }

    /** Method-security denial: authenticated but not permitted (403). */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> accessDenied(AccessDeniedException exception) {
        return respond(HttpStatus.FORBIDDEN, "Forbidden");
    }

    /** Unknown route (404). */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> notFound(NoResourceFoundException exception) {
        return respond(HttpStatus.NOT_FOUND, "Not found");
    }

    /** Malformed path/query arguments (400). */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> typeMismatch(MethodArgumentTypeMismatchException exception) {
        return respond(HttpStatus.BAD_REQUEST, "Validation error");
    }

    private static ResponseEntity<ErrorResponse> respond(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(new ErrorResponse(message));
    }

    /**
     * Frozen error wire shape: {@code {error: string}}.
     *
     * @param error human-readable error message
     */
    public record ErrorResponse(String error) {
    }
}
