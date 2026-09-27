package com.yacc.auth;

import java.util.List;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.web.authentication.ClientSecretBasicAuthenticationConverter;
import org.springframework.security.oauth2.server.authorization.web.authentication.ClientSecretPostAuthenticationConverter;
import org.springframework.security.oauth2.server.authorization.web.authentication.JwtClientAssertionAuthenticationConverter;
import org.springframework.security.oauth2.server.authorization.web.authentication.PublicClientAuthenticationConverter;
import org.springframework.security.web.authentication.AuthenticationConverter;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Client-authentication converters for the AS token/revocation endpoints
 * (MIG-033) — split out of the AS configuration (review loop 1:
 * configuration stays wiring, the converter assembly lives here).
 *
 * <p>The framework defaults (JWT assertion, basic, post, PKCE public
 * client) plus an extension for the public YACC frontend on the refresh and
 * revocation endpoints, which the framework otherwise refuses to
 * authenticate (OAuth 2.0 Security BCP posture — see
 * {@link AsRefreshTokenGenerator}). The extension authenticates the client
 * by its registered id only; the refresh token itself rotates on every use
 * (and replays are serialized — see
 * {@link AsRefreshTokenSerializationFilter}), so a stolen value is
 * worthless to a thief (compensating controls in
 * {@link AsRefreshTokenGenerator}).</p>
 */
@Component
public class AsClientAuthenticationConverter implements AuthenticationConverter {

    private final List<AuthenticationConverter> delegates;

    /** Constructor injection only (guardrails 004 §2; ADR-024; ADR-030). */
    public AsClientAuthenticationConverter() {
        this.delegates = List.of(
                new JwtClientAssertionAuthenticationConverter(),
                new ClientSecretBasicAuthenticationConverter(),
                new ClientSecretPostAuthenticationConverter(),
                new PublicClientAuthenticationConverter(),
                this::convertPublicRefreshOrRevokeClient);
    }

    @Override
    public Authentication convert(HttpServletRequest request) {
        // First-match composite (the framework's DelegatingAuthenticationConverter
        // is deprecated for removal with no replacement — SAS 1.4+).
        for (AuthenticationConverter converter : this.delegates) {
            Authentication authentication = converter.convert(request);
            if (authentication != null) {
                return authentication;
            }
        }
        return null;
    }

    private Authentication convertPublicRefreshOrRevokeClient(HttpServletRequest request) {
        String clientId = request.getParameter(OAuth2ParameterNames.CLIENT_ID);
        if (!StringUtils.hasText(clientId)
                || request.getParameter(OAuth2ParameterNames.CLIENT_SECRET) != null) {
            return null;
        }
        boolean refreshRequest = "refresh_token"
                .equals(request.getParameter(OAuth2ParameterNames.GRANT_TYPE));
        boolean revokeRequest = "/oauth2/revoke".equals(request.getRequestURI());
        if (!refreshRequest && !revokeRequest) {
            return null;
        }
        // Non-code-grant additional parameters: tells the framework's
        // code-verifier authenticator this dance carries no authorization
        // code, so only the registered client id authenticates here.
        return new OAuth2ClientAuthenticationToken(clientId,
                ClientAuthenticationMethod.NONE, null, Map.of());
    }
}
