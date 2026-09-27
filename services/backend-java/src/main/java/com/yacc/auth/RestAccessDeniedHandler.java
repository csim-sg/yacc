package com.yacc.auth;

import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Writes the canonical {@code {error}} body for filter-level authorization
 * denials (MIG-030; 403 — authenticated but not permitted). Wired as a bean
 * by {@code AuthSecurityConfig} with the shared Spring {@code ObjectMapper}
 * (constructor injection only — guardrails 004 §2; ADR-024; ADR-030).
 */
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final ObjectMapper mapper;

    public RestAccessDeniedHandler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(),
                mapper.createObjectNode().put("error", "Forbidden"));
    }
}
