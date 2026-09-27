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
import com.yacc.common.model.IntegrationErrorResponse;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Centralized REST error contract (ARCH-004 §5): every error response uses
 * the frozen wire shape {@code {error: string}} (POC routing-controllers
 * parity), except the integration surface — under {@code /api/integrations/}
 * the frozen shape is {@code {code, message}} (contract component
 * {@code IntegrationErrorResponse}), decided per request by the same advice.
 * Controllers never shape errors themselves; security filter-level denials
 * are rendered by the auth entry point / access-denied handler with the
 * {@code {error}} shape.
 *
 * <p>Placement: {@code common} — the one cross-cutting web error surface
 * shared by every feature controller (ADR-030 §4).</p>
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    /** Bean-validation failure on a request body (Zod parity). */
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<?> validationFailure(Exception exception, HttpServletRequest request) {
        if (isIntegration(request)) {
            return integration(HttpStatus.BAD_REQUEST,
                    IntegrationErrorResponse.VALIDATION_ERROR, "Validation error");
        }
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
    public ResponseEntity<?> badCredentials(BadCredentialsException exception,
            HttpServletRequest request) {
        if (isIntegration(request)) {
            return integration(HttpStatus.UNAUTHORIZED, "unauthorized", "Unauthorized");
        }
        return respond(HttpStatus.UNAUTHORIZED, exception.getMessage());
    }

    /** Method-security denial: authenticated but not permitted (403). */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<?> accessDenied(AccessDeniedException exception,
            HttpServletRequest request) {
        if (isIntegration(request)) {
            return integration(HttpStatus.FORBIDDEN, "forbidden", "Forbidden");
        }
        return respond(HttpStatus.FORBIDDEN, "Forbidden");
    }

    /** Unknown route (404). */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<?> notFound(NoResourceFoundException exception,
            HttpServletRequest request) {
        if (isIntegration(request)) {
            return integration(HttpStatus.NOT_FOUND, "not_found", "Not found");
        }
        return respond(HttpStatus.NOT_FOUND, "Not found");
    }

    /** Malformed path/query arguments (400). */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<?> typeMismatch(MethodArgumentTypeMismatchException exception,
            HttpServletRequest request) {
        if (isIntegration(request)) {
            return integration(HttpStatus.BAD_REQUEST,
                    IntegrationErrorResponse.VALIDATION_ERROR, "Validation error");
        }
        return respond(HttpStatus.BAD_REQUEST, "Validation error");
    }

    /** Semantic request validation failures raised by feature services (400). */
    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<?> badRequest(BadRequestException exception, HttpServletRequest request) {
        if (isIntegration(request)) {
            return integration(HttpStatus.BAD_REQUEST,
                    IntegrationErrorResponse.VALIDATION_ERROR, exception.getMessage());
        }
        return respond(HttpStatus.BAD_REQUEST, exception.getMessage());
    }

    /** Unknown referenced resource raised by a feature service (404). */
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<?> notFoundResource(NotFoundException exception,
            HttpServletRequest request) {
        if (isIntegration(request)) {
            return integration(HttpStatus.NOT_FOUND, "not_found", exception.getMessage());
        }
        return respond(HttpStatus.NOT_FOUND, exception.getMessage());
    }

    /** Resource-level authorization denial raised by a feature service (403). */
    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<?> forbidden(ForbiddenException exception, HttpServletRequest request) {
        if (isIntegration(request)) {
            return integration(HttpStatus.FORBIDDEN, "forbidden", exception.getMessage());
        }
        return respond(HttpStatus.FORBIDDEN, exception.getMessage());
    }

    /** Uniqueness violation raised by a feature service (409). */
    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ErrorResponse> conflict(ConflictException exception) {
        return respond(HttpStatus.CONFLICT, exception.getMessage());
    }

    /** Valid-input operation failure raised by a feature service (500). */
    @ExceptionHandler(InternalServerErrorException.class)
    public ResponseEntity<?> internal(InternalServerErrorException exception,
            HttpServletRequest request) {
        if (isIntegration(request)) {
            return integration(HttpStatus.INTERNAL_SERVER_ERROR,
                    IntegrationErrorResponse.INTERNAL_ERROR, exception.getMessage());
        }
        return respond(HttpStatus.INTERNAL_SERVER_ERROR, exception.getMessage());
    }

    /** Integration-domain failure with its frozen {code,message} shape. */
    @ExceptionHandler(IntegrationApiException.class)
    public ResponseEntity<IntegrationErrorResponse> integration(
            IntegrationApiException exception) {
        return integration(HttpStatus.resolve(exception.statusCode()), exception.code(),
                exception.getMessage());
    }

    private static boolean isIntegration(HttpServletRequest request) {
        return request != null && request.getRequestURI().startsWith("/api/integrations/");
    }

    private static ResponseEntity<IntegrationErrorResponse> integration(HttpStatus status,
            String code, String message) {
        HttpStatus safe = status == null ? HttpStatus.INTERNAL_SERVER_ERROR : status;
        return ResponseEntity.status(safe)
                .body(new IntegrationErrorResponse(code, message));
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
