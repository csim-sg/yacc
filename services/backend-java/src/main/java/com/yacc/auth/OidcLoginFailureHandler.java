package com.yacc.auth;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Writes the canonical frozen 401 {@code {error}} body for a failed OIDC
 * relying-party login (MIG-032): unknown external identities, unverified
 * e-mails, inactive/suspended matches, and IdP/protocol failures are all
 * denied uniformly — the denial reason stays in the audit trail, never on the
 * wire (anti-enumeration parity with {@link RestAuthenticationEntryPoint}).
 * The triggering exception is logged at WARN (structured security signal; no
 * token material). Wired as a bean by {@code OAuth2LoginConfig} with the
 * shared Spring {@code ObjectMapper} (constructor injection only —
 * guardrails 004 §2; ADR-024; ADR-030).
 */
public class OidcLoginFailureHandler implements AuthenticationFailureHandler {

    private static final Logger LOG =
            LoggerFactory.getLogger(OidcLoginFailureHandler.class);

    private final ObjectMapper mapper;

    public OidcLoginFailureHandler(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void onAuthenticationFailure(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authenticationException) throws IOException {
        LOG.warn("OIDC login failed: {}",
                authenticationException.getClass().getSimpleName(),
                authenticationException);
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(),
                mapper.createObjectNode().put("error", "Authentication required"));
    }
}
