package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;

import com.nimbusds.jose.jwk.KeyType;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.JWKMatcher;
import com.nimbusds.jose.jwk.JWKSelector;
import com.yacc.auth.service.JwtTokenService;

/**
 * Unit tests for the embedded authorization-server policy (MIG-033;
 * ADR-025 AS role): fail-closed registered-client validation, the
 * founder-fixed public-client/PKCE/consent posture, shared token TTLs, the
 * configured issuer, and the JWKS source backed by the SAME key family as
 * the resource server (no second signing-key source).
 */
class AuthorizationServerConfigTest {

    private static final String KEY = generatedKey(2048);

    private static String generatedKey(int bits) {
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
                new AuthProperties.Token(KEY, null, null),
                new AuthProperties.Bootstrap("bootstrap@fixture.yacc.local", "initial"),
                new AuthProperties.Recovery("", "", ""), null, null, null, null, as);
    }

    private static AuthProperties.As defaultAs() {
        return new AuthProperties.As("https://yacc.fixture.local", Map.of(
                "yacc-frontend", new AuthProperties.As.AsClient("yacc-frontend",
                        List.of("http://localhost:5173/auth/callback"), null)));
    }

    @Test
    void registeredClientPolicyIsPublicPkceConsentCodePlusRefresh() {
        RegisteredClientRepository repository = new AuthorizationServerConfig()
                .registeredClientRepository(asProperties(defaultAs()));

        RegisteredClient client = repository.findByClientId("yacc-frontend");
        assertThat(client).isNotNull();
        assertThat(client.getClientAuthenticationMethods())
                .containsExactly(ClientAuthenticationMethod.NONE);
        assertThat(client.getAuthorizationGrantTypes()).containsExactlyInAnyOrder(
                AuthorizationGrantType.AUTHORIZATION_CODE,
                AuthorizationGrantType.REFRESH_TOKEN);
        assertThat(client.getAuthorizationGrantTypes())
                .doesNotContain(AuthorizationGrantType.CLIENT_CREDENTIALS);
        ClientSettings clientSettings = client.getClientSettings();
        assertThat(clientSettings.isRequireProofKey()).isTrue();
        assertThat(clientSettings.isRequireAuthorizationConsent()).isTrue();
        assertThat(client.getRedirectUris())
                .containsExactly("http://localhost:5173/auth/callback");
    }

    @Test
    void tokenSettingsReuseTheSharedTtlPolicyAndRotateRefreshTokens() {
        AuthProperties properties = asProperties(defaultAs());
        RegisteredClient client = new AuthorizationServerConfig()
                .registeredClientRepository(properties).findByClientId("yacc-frontend");

        TokenSettings tokenSettings = client.getTokenSettings();
        assertThat(tokenSettings.getAccessTokenTimeToLive())
                .isEqualTo(properties.token().accessTtl());
        assertThat(tokenSettings.getRefreshTokenTimeToLive())
                .isEqualTo(properties.token().refreshTtl());
        assertThat(tokenSettings.isReuseRefreshTokens()).isFalse();
    }

    @Test
    void scopesDefaultToOidcProfileEmail() {
        RegisteredClient client = new AuthorizationServerConfig()
                .registeredClientRepository(asProperties(defaultAs()))
                .findByClientId("yacc-frontend");
        assertThat(client.getScopes()).containsExactly("openid", "profile", "email");
    }

    @Test
    void emptyClientRegistryFailsStartup() {
        assertThatThrownBy(() -> new AuthorizationServerConfig()
                .registeredClientRepository(asProperties(new AuthProperties.As(null, Map.of()))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least one client");
    }

    @Test
    void missingClientIdFailsStartup() {
        AuthProperties.As.AsClient client = new AuthProperties.As.AsClient("  ",
                List.of("http://localhost:5173/auth/callback"), null);
        assertThatThrownBy(() -> new AuthorizationServerConfig()
                .registeredClientRepository(asProperties(new AuthProperties.As(null,
                        Map.of("yacc-frontend", client)))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("client-id");
    }

    @Test
    void missingRedirectUrisFailStartup() {
        AuthProperties.As.AsClient client = new AuthProperties.As.AsClient("yacc-frontend",
                List.of(), null);
        assertThatThrownBy(() -> new AuthorizationServerConfig()
                .registeredClientRepository(asProperties(new AuthProperties.As(null,
                        Map.of("yacc-frontend", client)))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("redirect-uris");
    }

    @Test
    void missingOpenidScopeFailsStartup() {
        AuthProperties.As.AsClient client = new AuthProperties.As.AsClient("yacc-frontend",
                List.of("http://localhost:5173/auth/callback"), List.of("profile"));
        assertThatThrownBy(() -> new AuthorizationServerConfig()
                .registeredClientRepository(asProperties(new AuthProperties.As(null,
                        Map.of("yacc-frontend", client)))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("openid");
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
