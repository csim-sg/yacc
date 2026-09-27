package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;

/**
 * MIG-032 fail-closed configuration tests for {@link OAuth2LoginConfig}:
 * enabling the relying party without at least one complete registration must
 * fail startup (never serve a half-configured IdP surface).
 */
class OAuth2LoginConfigTest {

    private final OAuth2LoginConfig config = new OAuth2LoginConfig();

    private static AuthProperties.OAuth2.Registration registration(String clientSecret) {
        return new AuthProperties.OAuth2.Registration("client-id", clientSecret,
                "https://idp.fixture", "https://idp.fixture/authorize",
                "https://idp.fixture/token", "https://idp.fixture/jwks", null, null, null);
    }

    private static AuthProperties properties(AuthProperties.OAuth2 oauth2) {
        return new AuthProperties(null, null, null, null, null, null, oauth2, null);
    }

    @Test
    void enablingWithoutRegistrationsFailsStartup() {
        assertThatThrownBy(() -> config.clientRegistrationRepository(
                properties(new AuthProperties.OAuth2(true, Map.of()))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("no registrations");
    }

    @Test
    void enablingWithAnIncompleteRegistrationFailsStartupNamingTheProperty() {
        assertThatThrownBy(() -> config.clientRegistrationRepository(
                properties(new AuthProperties.OAuth2(true,
                        Map.of("fixture-idp", registration(null))))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("yacc.auth.oauth2.registrations.fixture-idp.client-secret");
    }

    @Test
    void enablingWithAMissingIssuerUriFailsStartupNamingTheProperty() {
        // Regression (Review Loop 1, finding 1): Spring Security validates the
        // ID-token issuer only when an issuer is configured — a registration
        // without issuer-uri would fail startup-closed, never boot with the
        // issuer check silently absent.
        assertThatThrownBy(() -> config.clientRegistrationRepository(
                properties(new AuthProperties.OAuth2(true, Map.of("fixture-idp",
                        new AuthProperties.OAuth2.Registration("client-id", "secret", null,
                                "https://idp.fixture/authorize", "https://idp.fixture/token",
                                "https://idp.fixture/jwks", null, null, null))))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("yacc.auth.oauth2.registrations.fixture-idp.issuer-uri");
    }

    @Test
    void aCompleteRegistrationBuildsWithTheKissDefaults() {
        ClientRegistrationRepository repository = config.clientRegistrationRepository(
                properties(new AuthProperties.OAuth2(true, Map.of("fixture-idp",
                        registration("secret")))));

        ClientRegistration built = repository.findByRegistrationId("fixture-idp");
        assertThat(built).isNotNull();
        assertThat(built.getClientId()).isEqualTo("client-id");
        assertThat(built.getRedirectUri())
                .isEqualTo("{baseUrl}/api/auth/oidc/callback/{registrationId}");
        assertThat(built.getScopes())
                .containsExactlyInAnyOrderElementsOf(AuthProperties.OAuth2.DEFAULT_SCOPES);
        assertThat(built.getProviderDetails().getUserInfoEndpoint().getUserNameAttributeName())
                .isEqualTo(AuthProperties.OAuth2.DEFAULT_USER_NAME_ATTRIBUTE);
        assertThat(built.getProviderDetails().getUserInfoEndpoint().getUri()).isNull();
        assertThat(built.getProviderDetails().getIssuerUri()).isEqualTo("https://idp.fixture");
    }
}
