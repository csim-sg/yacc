package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;

/**
 * Unit tests for the embedded authorization-server registered-client policy
 * (MIG-033; ADR-025 AS role; review loop 1 split): fail-closed validation,
 * the founder-fixed public-client/PKCE/consent posture, shared token TTLs,
 * and refresh-token rotation.
 */
class AsClientPolicyTest {

    private static final String KEY = AuthorizationServerConfigTest.generatedKey(2048);

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
        RegisteredClient client = new AsClientPolicy(asProperties(defaultAs()))
                .findByClientId("yacc-frontend");

        assertThat(client).isNotNull();
        assertThat(client.getClientAuthenticationMethods())
                .containsExactly(ClientAuthenticationMethod.NONE);
        assertThat(client.getAuthorizationGrantTypes()).containsExactlyInAnyOrder(
                AuthorizationGrantType.AUTHORIZATION_CODE,
                AuthorizationGrantType.REFRESH_TOKEN);
        assertThat(client.getAuthorizationGrantTypes())
                .doesNotContain(AuthorizationGrantType.CLIENT_CREDENTIALS);
        assertThat(client.getClientSettings().isRequireProofKey()).isTrue();
        assertThat(client.getClientSettings().isRequireAuthorizationConsent()).isTrue();
        assertThat(client.getRedirectUris())
                .containsExactly("http://localhost:5173/auth/callback");
    }

    @Test
    void tokenSettingsReuseTheSharedTtlPolicyAndRotateRefreshTokens() {
        AuthProperties properties = asProperties(defaultAs());
        RegisteredClient client = new AsClientPolicy(properties)
                .findByClientId("yacc-frontend");

        TokenSettings tokenSettings = client.getTokenSettings();
        assertThat(tokenSettings.getAccessTokenTimeToLive())
                .isEqualTo(properties.token().accessTtl());
        assertThat(tokenSettings.getRefreshTokenTimeToLive())
                .isEqualTo(properties.token().refreshTtl());
        assertThat(tokenSettings.isReuseRefreshTokens()).isFalse();
    }

    @Test
    void scopesDefaultToOidcProfileEmail() {
        RegisteredClient client = new AsClientPolicy(asProperties(defaultAs()))
                .findByClientId("yacc-frontend");
        assertThat(client.getScopes()).containsExactly("openid", "profile", "email");
    }

    @Test
    void emptyClientRegistryFailsStartup() {
        assertThatThrownBy(() -> new AsClientPolicy(
                asProperties(new AuthProperties.As(null, Map.of()))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least one client");
    }

    @Test
    void missingClientIdFailsStartup() {
        AuthProperties.As.AsClient client = new AuthProperties.As.AsClient("  ",
                List.of("http://localhost:5173/auth/callback"), null);
        assertThatThrownBy(() -> new AsClientPolicy(asProperties(
                new AuthProperties.As(null, Map.of("yacc-frontend", client)))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("client-id");
    }

    @Test
    void missingRedirectUrisFailStartup() {
        AuthProperties.As.AsClient client = new AuthProperties.As.AsClient("yacc-frontend",
                List.of(), null);
        assertThatThrownBy(() -> new AsClientPolicy(asProperties(
                new AuthProperties.As(null, Map.of("yacc-frontend", client)))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("redirect-uris");
    }

    @Test
    void missingOpenidScopeFailsStartup() {
        AuthProperties.As.AsClient client = new AuthProperties.As.AsClient("yacc-frontend",
                List.of("http://localhost:5173/auth/callback"), List.of("profile"));
        assertThatThrownBy(() -> new AsClientPolicy(asProperties(
                new AuthProperties.As(null, Map.of("yacc-frontend", client)))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("openid");
    }
}
