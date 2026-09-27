package com.yacc.auth;

import java.io.IOException;

import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.yacc.auth.model.AuthSessionResponse;
import com.yacc.auth.model.AuthUser;
import com.yacc.auth.model.Session;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserResponse;
import com.yacc.auth.model.YaccOidcUser;
import com.yacc.auth.service.JwtTokenService;
import com.yacc.auth.service.SessionService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Completes the OIDC relying-party login with the YACC session contract
 * (MIG-032; ADR-025): issues a refresh grant + stateless RS256 access token
 * for the explicitly linked identity resolved by the OIDC user service, then
 * answers the RP callback with the same canonical {@code AuthSessionResponse}
 * body as local sign-in — the surface the MIG-034 frontend adaptation
 * consumes. {@code user.login} audit parity is provided by the Spring
 * Security authentication event (principal name = the YACC user id).
 *
 * <p>Wired as a bean by {@code OAuth2LoginConfig} with the shared Spring
 * {@code ObjectMapper} and constructor injection only (guardrails 004 §2;
 * ADR-024; ADR-030).</p>
 */
public class OidcLoginSuccessHandler implements AuthenticationSuccessHandler {

    private final SessionService sessions;

    private final JwtTokenService tokens;

    private final ObjectMapper mapper;

    public OidcLoginSuccessHandler(SessionService sessions, JwtTokenService tokens,
            ObjectMapper mapper) {
        this.sessions = sessions;
        this.tokens = tokens;
        this.mapper = mapper;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
            Authentication authentication) throws IOException {
        YaccOidcUser principal = (YaccOidcUser) authentication.getPrincipal();
        User user = principal.user();
        Session session = sessions.issue(user);
        String accessToken = tokens.issueAccessToken(new AuthUser(user), session.getId());
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getOutputStream(), new AuthSessionResponse(
                UserResponse.from(user), accessToken, session.getToken(),
                user.isMustChangePassword()));
    }
}
