package com.yacc.auth;

import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;

import com.yacc.auth.service.TokenAuthenticationService;

/**
 * Status-enforcing authorization-store seam for the embedded AS (MIG-033;
 * ADR-025 — suspended/revoked accounts are denied at BOTH AS and
 * resource-server roles).
 *
 * <p>A refresh or revocation request carries no bearer token, so the
 * shared bearer seam is never exercised on it; without this seam a
 * suspension after the original authorization would still mint fresh
 * access tokens from the stored grant. Every grant resolution — refresh,
 * authorization-code exchange, revocation, userinfo — re-loads the stored
 * authorization's owner from the database through the single status seam
 * ({@link TokenAuthenticationService#requireActive(String)}) BEFORE the
 * grant is processed: a grant whose owner is missing or not {@code ACTIVE}
 * resolves to {@code null}, so the framework answers {@code invalid_grant}
 * on refresh/code exchange, treats revocation as an RFC 7009 §2.2 no-op
 * (token validity stays private), and refuses userinfo with the stale
 * access token. The standard token format is untouched — this gates
 * resolution only.</p>
 */
public final class AsStatusEnforcingAuthorizationService
        implements OAuth2AuthorizationService {

    private final OAuth2AuthorizationService delegate;

    private final TokenAuthenticationService identities;

    /** Constructor injection only (ARCH-004 §2; ADR-024; ADR-030). */
    public AsStatusEnforcingAuthorizationService(
            OAuth2AuthorizationService delegate,
            TokenAuthenticationService identities) {
        this.delegate = delegate;
        this.identities = identities;
    }

    @Override
    public void save(OAuth2Authorization authorization) {
        this.delegate.save(authorization);
    }

    @Override
    public void remove(OAuth2Authorization authorization) {
        this.delegate.remove(authorization);
    }

    @Override
    public OAuth2Authorization findById(String id) {
        return this.delegate.findById(id);
    }

    /**
     * Fail-closed resolution: an existing grant whose owner no longer
     * resolves to an {@code ACTIVE} identity is invisible to every grant
     * flow, exactly like a missing grant.
     */
    @Override
    public OAuth2Authorization findByToken(String token, OAuth2TokenType tokenType) {
        OAuth2Authorization authorization = this.delegate.findByToken(token, tokenType);
        if (authorization == null) {
            return null;
        }
        try {
            this.identities.requireActive(authorization.getPrincipalName());
        } catch (InvalidBearerTokenException denied) {
            return null;
        }
        return authorization;
    }
}
