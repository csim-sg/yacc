package com.yacc.auth;

import java.io.IOException;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.auth.model.AuthUser;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Enforces the forced-password-change state of bootstrap/recovery identities
 * (MIG-030; ADR-025). An authenticated identity flagged
 * {@code must_change_password} may reach only the auth endpoints (sign-in,
 * sign-up, sign-out, session, refresh, credential replacement) plus the
 * probe/scrape surface — every other path is denied with 403 so a
 * bootstrap credential cannot operate the platform before being replaced.
 * Wired as a bean by {@code AuthSecurityConfig} with the shared Spring
 * {@code ObjectMapper} (constructor injection only — guardrails 004 §2;
 * ADR-024; ADR-030).
 */
public class ForcedPasswordChangeFilter extends OncePerRequestFilter {

    /** Surfaces a flagged identity may still use. */
    private static final List<String> ALLOWED_PREFIXES =
            List.of("/api/auth/", "/health", "/actuator");

    private final ObjectMapper mapper;

    public ForcedPasswordChangeFilter(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.getPrincipal() instanceof AuthUser user
                && user.isMustChangePassword()
                && !isAllowed(request.getRequestURI())) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            mapper.writeValue(response.getOutputStream(), mapper.createObjectNode()
                    .put("error", "Password change required"));
            return;
        }
        filterChain.doFilter(request, response);
    }

    private static boolean isAllowed(String requestUri) {
        return ALLOWED_PREFIXES.stream().anyMatch(requestUri::startsWith);
    }
}
