package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.oidc.authentication.OidcUserInfoAuthenticationContext;
import org.springframework.security.oauth2.server.authorization.oidc.authentication.OidcUserInfoAuthenticationToken;

/**
 * Unit tests for the OIDC UserInfo projection (MIG-033; review loop 1
 * split; OIDC core §5.3): {@code sub} always, email/profile claims strictly
 * per granted scope, and the YACC role claim carried when present.
 */
class AsUserInfoProjectionTest {

    private static final String CLIENT_ID = "yacc-frontend";

    private final AsUserInfoProjection projection = new AsUserInfoProjection();

    private static RegisteredClient registeredClient() {
        return RegisteredClient.withId("registration-1")
                .clientId(CLIENT_ID)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("http://localhost:5173/auth/callback")
                .scope(OidcScopes.OPENID)
                .build();
    }

    private OidcUserInfoAuthenticationContext context(Set<String> authorizedScopes,
            Map<String, Object> idTokenClaims) {
        OidcIdToken idToken = new OidcIdToken("id-token-value", Instant.now(),
                Instant.now().plusSeconds(300), idTokenClaims);
        OAuth2Authorization authorization = OAuth2Authorization
                .withRegisteredClient(registeredClient())
                .id("authz-1")
                .principalName("principal-1")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizedScopes(authorizedScopes)
                .token(idToken)
                .build();
        OidcUserInfoAuthenticationToken request =
                new OidcUserInfoAuthenticationToken(
                        new TestingAuthenticationToken(CLIENT_ID, "none"));
        return OidcUserInfoAuthenticationContext.with(request)
                .accessToken(new OAuth2AccessToken(OAuth2AccessToken.TokenType.BEARER,
                        "userinfo-access-token", Instant.now(),
                        Instant.now().plusSeconds(60)))
                .authorization(authorization)
                .build();
    }

    @Test
    void servesSubAndScopeFilteredClaims() {
        OidcUserInfo userInfo = this.projection.apply(context(
                Set.of(OidcScopes.OPENID, OidcScopes.PROFILE, OidcScopes.EMAIL),
                Map.of("sub", "user-1",
                        "email", "userinfo@fixture.yacc.local",
                        "email_verified", true,
                        "name", "Fixture User",
                        "role", "user")));

        assertThat(userInfo.getClaimAsString("sub")).isEqualTo("user-1");
        assertThat(userInfo.getClaimAsString("email"))
                .isEqualTo("userinfo@fixture.yacc.local");
        assertThat(userInfo.getClaimAsBoolean("email_verified")).isTrue();
        assertThat(userInfo.getClaimAsString("name")).isEqualTo("Fixture User");
        assertThat(userInfo.getClaimAsString("role")).isEqualTo("user");
    }

    @Test
    void omitsClaimsOutsideTheGrantedScopes() {
        OidcUserInfo userInfo = this.projection.apply(context(
                Set.of(OidcScopes.OPENID),
                Map.of("sub", "user-1",
                        "email", "userinfo@fixture.yacc.local",
                        "email_verified", true,
                        "name", "Fixture User")));

        assertThat(userInfo.getClaimAsString("sub")).isEqualTo("user-1");
        assertThat(userInfo.getClaimAsString("email")).isNull();
        assertThat(userInfo.getClaimAsString("email_verified")).isNull();
        assertThat(userInfo.getClaimAsString("name")).isNull();
    }

    @Test
    void omitsRoleWhenTheIdTokenCarriesNone() {
        OidcUserInfo userInfo = this.projection.apply(context(
                Set.of(OidcScopes.OPENID), Map.of("sub", "user-1")));

        assertThat(userInfo.getClaimAsString("sub")).isEqualTo("user-1");
        assertThat(userInfo.getClaimAsString("role")).isNull();
    }
}
