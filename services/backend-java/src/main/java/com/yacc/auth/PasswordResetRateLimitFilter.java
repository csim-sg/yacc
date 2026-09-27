package com.yacc.auth;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Fixed-window per-IP rate limit on the password-reset wire surface
 * (MIG-031; frozen contract 429s; ledger row REST-XSRV-003 policy parity
 * with the POC {@code passwordResetRateLimiter}: 3 requests per hour per
 * IP). Applies to {@code POST /api/auth/forgot-password} and
 * {@code POST /api/auth/reset-password}; every other request passes
 * through untouched. In-memory state matches the single-instance
 * deployment envelope (SPEC-002); expired windows are purged
 * opportunistically.
 *
 * <p>Registered as a bean by {@code AuthSecurityConfig} with the shared
 * Spring {@code ObjectMapper} (constructor injection only — guardrails
 * 004 §2).</p>
 */
public class PasswordResetRateLimitFilter extends OncePerRequestFilter {

    /** Approved parity with the POC {@code passwordResetRateLimiter}. */
    static final int LIMIT = 3;

    /** Approved parity: one-hour fixed window. */
    static final Duration WINDOW = Duration.ofHours(1);

    private static final List<String> LIMITED_PATHS = List.of(
            "/api/auth/forgot-password",
            "/api/auth/reset-password");

    private static final String ERROR_MESSAGE =
            "Too many password reset attempts. Please try again in 1 hour.";

    private final ObjectMapper mapper;
    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public PasswordResetRateLimitFilter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "OPTIONS".equalsIgnoreCase(request.getMethod())
                || !LIMITED_PATHS.contains(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        purgeExpiredWindows(Instant.now());
        String key = request.getRemoteAddr();
        Window window = windows.compute(key,
                (ignored, existing) -> Window.next(existing, Instant.now()));
        if (window.count().incrementAndGet() > LIMIT) {
            respondTooManyRequests(response, window);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private void respondTooManyRequests(HttpServletResponse response, Window window)
            throws IOException {
        Instant resetAt = Instant.ofEpochMilli(window.startedAt().toEpochMilli()
                + WINDOW.toMillis());
        response.setStatus(429);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setHeader("RateLimit-Limit", String.valueOf(LIMIT));
        response.setHeader("RateLimit-Remaining", "0");
        response.setHeader("RateLimit-Reset", String.valueOf(resetAt.getEpochSecond()));
        mapper.writeValue(response.getOutputStream(), mapper.createObjectNode()
                .put("error", ERROR_MESSAGE));
    }

    private void purgeExpiredWindows(Instant now) {
        Iterator<Map.Entry<String, Window>> entries = windows.entrySet().iterator();
        while (entries.hasNext()) {
            if (Window.isExpired(entries.next().getValue(), now)) {
                entries.remove();
            }
        }
    }

    /**
     * One fixed-window counter for a client address.
     *
     * @param startedAt window start
     * @param count     requests observed in this window
     */
    private record Window(Instant startedAt, AtomicInteger count) {

        static Window next(Window existing, Instant now) {
            if (existing == null || isExpired(existing, now)) {
                return new Window(now, new AtomicInteger());
            }
            return existing;
        }

        static boolean isExpired(Window window, Instant now) {
            return window.startedAt().plus(WINDOW).isBefore(now);
        }
    }
}
