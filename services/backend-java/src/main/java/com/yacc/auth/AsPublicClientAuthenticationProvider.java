package com.yacc.auth;

import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;

/**
 * Client authentication for the PUBLIC YACC frontend on the AS refresh and
 * revocation endpoints (MIG-033; ADR-025 AS role).
 *
 * <p>The framework's public-client provider deliberately authenticates only
 * the authorization-code exchange (OAuth 2.0 Security BCP posture), which
 * would leave refresh tokens issued by {@link AsRefreshTokenGenerator}
 * un-rotatable and un-revocable. This provider closes that gap for the
 * founder-fixed public SPA client: it authenticates the client by its
 * registered id (the only safe signal a public client holds) and lets the
 * framework's grant providers verify the presented token. Compensating
 * controls: PKCE (S256) on the originating grant, refresh-token rotation on
 * every use ({@code reuseRefreshTokens=false}), process-local grant store,
 * and per-request account-status enforcement.</p>
 */
public final class AsPublicClientAuthenticationProvider implements AuthenticationProvider {

    private final RegisteredClientRepository registeredClientRepository;

    /** Constructor injection only (guardrails 004 §2; ADR-024; ADR-030). */
    public AsPublicClientAuthenticationProvider(RegisteredClientRepository registeredClientRepository) {
        this.registeredClientRepository = registeredClientRepository;
    }

    @Override
    public Authentication authenticate(Authentication authentication)
            throws AuthenticationException {
        OAuth2ClientAuthenticationToken clientAuthentication =
                (OAuth2ClientAuthenticationToken) authentication;
        if (clientAuthentication.isAuthenticated()
                || !ClientAuthenticationMethod.NONE.equals(
                        clientAuthentication.getClientAuthenticationMethod())
                || !(clientAuthentication.getPrincipal() instanceof String clientId)
                // Only the refresh/revoke tokens this assembly produces carry
                // empty additional parameters; PKCE code exchanges (with
                // their parameters) stay with the framework's provider so a
                // failed code-verifier check can never be bypassed here.
                || !clientAuthentication.getAdditionalParameters().isEmpty()) {
            return null;
        }
        RegisteredClient registeredClient =
                this.registeredClientRepository.findByClientId(clientId);
        if (registeredClient == null
                || !registeredClient.getClientAuthenticationMethods()
                        .contains(ClientAuthenticationMethod.NONE)) {
            throw new OAuth2AuthenticationException(
                    new OAuth2Error("invalid_client"));
        }
        return new OAuth2ClientAuthenticationToken(registeredClient,
                ClientAuthenticationMethod.NONE, clientAuthentication.getCredentials());
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return OAuth2ClientAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
