package com.yacc.auth;

import java.time.Instant;
import java.util.Base64;

import org.springframework.security.crypto.keygen.Base64StringKeyGenerator;
import org.springframework.security.crypto.keygen.StringKeyGenerator;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;

/**
 * Refresh-token generator that also serves PUBLIC clients (MIG-033).
 *
 * <p>The framework's {@code OAuth2RefreshTokenGenerator} deliberately
 * refuses refresh tokens to public clients (OAuth 2.0 Security BCP §2.2.2).
 * YACC's founder-fixed authorization-server policy requires the refresh
 * grant for the YACC frontend (an inherently public SPA client — ADR-025
 * "authorization-code + refresh minimum"), so this generator issues the
 * standard 256-bit opaque refresh token for any registered client that owns
 * the refresh grant. Compensating controls (SEC review record, AC-MIG-033):
 * PKCE (S256) is mandatory for the public client, refresh tokens rotate on
 * every use ({@code reuseRefreshTokens=false}, MIG-030 rotate parity), the
 * store is process-local, and account status is re-enforced per request.</p>
 */
public final class AsRefreshTokenGenerator
        implements OAuth2TokenGenerator<OAuth2RefreshToken> {

    private final StringKeyGenerator generator =
            new Base64StringKeyGenerator(Base64.getUrlEncoder().withoutPadding(), 96);

    @Override
    public OAuth2RefreshToken generate(OAuth2TokenContext context) {
        if (context.getTokenType() == null
                || !OAuth2TokenType.REFRESH_TOKEN.equals(context.getTokenType())) {
            return null;
        }
        if (!context.getRegisteredClient().getAuthorizationGrantTypes()
                .contains(AuthorizationGrantType.REFRESH_TOKEN)) {
            return null;
        }
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(
                context.getRegisteredClient().getTokenSettings().getRefreshTokenTimeToLive());
        return new OAuth2RefreshToken(this.generator.generateKey(), issuedAt, expiresAt);
    }
}
