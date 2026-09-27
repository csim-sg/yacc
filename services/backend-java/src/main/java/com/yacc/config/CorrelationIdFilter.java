package com.yacc.config;

import java.io.IOException;
import java.util.UUID;

import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Correlation-id servlet filter (SPEC-002 TR-07; ADR-029; ledger REST-XSRV-004).
 *
 * <p>Java/Spring counterpart of the POC {@code correlationId.middleware.ts}:
 * the id is taken from the {@code X-Correlation-Id} header, then
 * {@code X-Request-Id}, otherwise a random UUID is generated. It is bound to
 * the SLF4J MDC (so every log line on the request thread carries it, matching
 * the POC's pino child-logger binding) and echoed as the
 * {@code X-Correlation-Id} response header.</p>
 *
 * <p>Placed (with its registration) in {@code config} per the tech-lead
 * placement ruling on this issue: {@code common} holds only true
 * cross-cutting types/utilities, and a servlet filter is runtime web
 * middleware (guardrails 004 §4/§5; ADR-030 §2).</p>
 */
public class CorrelationIdFilter extends OncePerRequestFilter {

    /** MDC key under which the correlation id is visible to logback/slf4j. */
    public static final String CORRELATION_ID_MDC_KEY = "correlationId";

    /** Response header echoing the correlation id back to the caller. */
    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";

    private static final String REQUEST_ID_HEADER = "X-Request-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String correlationId = correlationId(request);
        try {
            MDC.put(CORRELATION_ID_MDC_KEY, correlationId);
            response.setHeader(CORRELATION_ID_HEADER, correlationId);
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(CORRELATION_ID_MDC_KEY);
        }
    }

    private String correlationId(HttpServletRequest request) {
        String correlationId = request.getHeader(CORRELATION_ID_HEADER);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = request.getHeader(REQUEST_ID_HEADER);
        }
        return (correlationId == null || correlationId.isBlank()) ? UUID.randomUUID().toString() : correlationId;
    }
}
