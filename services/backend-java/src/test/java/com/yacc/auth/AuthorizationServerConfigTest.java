package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;

import com.nimbusds.jose.jwk.KeyType;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKMatcher;
import com.nimbusds.jose.jwk.JWKSelector;
import com.yacc.auth.service.JwtTokenService;

/**
 * Unit tests for the AS configuration wiring (MIG-033; review loop 1: the
 * configuration is the single AS entry point and wiring only — policy lives
 * in the focused auth components, e.g. {@link AsClientPolicyTest}): the
 * configured issuer, the JWKS source backed by the SAME key family as the
 * resource server (no second signing-key source), and the shared property
 * defaults.
 */
class AuthorizationServerConfigTest {

    static String generatedKey(int bits) {
        try {
            java.security.KeyPairGenerator generator =
                    java.security.KeyPairGenerator.getInstance("RSA");
            generator.initialize(bits);
            return Base64.getEncoder().encodeToString(
                    generator.generateKeyPair().getPrivate().getEncoded());
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static AuthProperties asProperties(AuthProperties.As as) {
        return new AuthProperties(
                new AuthProperties.Token(generatedKey(2048), null, null),
                new AuthProperties.Bootstrap("bootstrap@fixture.yacc.local", "initial"),
                new AuthProperties.Recovery("", "", ""), null, null, null, null, as);
    }

    private static AuthProperties.As defaultAs() {
        return new AuthProperties.As("https://yacc.fixture.local", Map.of(
                "yacc-frontend", new AuthProperties.As.AsClient("yacc-frontend",
                        List.of("http://localhost:5173/auth/callback"), null)));
    }

    @Test
    void authorizationServerSettingsCarryTheConfiguredIssuer() {
        AuthorizationServerSettings settings = new AuthorizationServerConfig()
                .authorizationServerSettings(asProperties(
                        new AuthProperties.As("https://as.fixture.local", Map.of())));
        assertThat(settings.getIssuer()).isEqualTo("https://as.fixture.local");
    }

    @Test
    void missingIssuerSectionDefaultsToTheLocalDevIssuer() {
        AuthorizationServerSettings settings = new AuthorizationServerConfig()
                .authorizationServerSettings(asProperties(null));
        assertThat(settings.getIssuer())
                .isEqualTo(AuthProperties.As.DEFAULT_ISSUER);
    }

    @Test
    void jwkSourceServesTheSharedResourceServerSigningKey() throws
            com.nimbusds.jose.KeySourceException {
        AuthProperties properties = asProperties(defaultAs());
        JwtTokenService tokenService = new JwtTokenService(properties);

        var source = new AuthorizationServerConfig().jwkSource(tokenService);
        var selector = new JWKSelector(new JWKMatcher.Builder().keyType(KeyType.RSA).build());
        List<JWK> served = source.get(selector, null);

        assertThat(served).hasSize(1);
        assertThat(served.get(0).toPublicJWK().toJSONObject())
                .isEqualTo(tokenService.signingKey().toPublicJWK().toJSONObject());
    }

    /** Keep the rotation parity visible: the AS key IS the token key. */
    @Test
    void ttlDefaultsApplyWhenTokenSectionOmitted() {
        AuthProperties properties = asProperties(null);
        assertThat(properties.token().accessTtl()).isEqualTo(Duration.ofMinutes(30));
        assertThat(properties.token().refreshTtl()).isEqualTo(Duration.ofDays(30));
        assertThat(properties.as().issuer())
                .isEqualTo(AuthProperties.As.DEFAULT_ISSUER);
    }

    @Test
    void oidcScopesConstantMatchesTheDefaultScopeList() {
        assertThat(AuthProperties.As.AsClient.DEFAULT_SCOPES)
                .contains(OidcScopes.OPENID, OidcScopes.PROFILE, OidcScopes.EMAIL);
    }
}
