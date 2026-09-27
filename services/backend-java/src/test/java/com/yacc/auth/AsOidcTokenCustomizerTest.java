package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.oidc.OidcScopes;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContext;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext;

import com.yacc.auth.model.AuthUser;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;

/**
 * Unit tests for the AS JWT claim policy (MIG-033; review loop 1 split):
 * the MIG-030 role/email contract claims on access tokens, the
 * scope-conditional OIDC profile/email claims on ID tokens, the
 * {@code must_change_password} bootstrap signal, and the fail-silent
 * behavior for non-AuthUser principals.
 */
class AsOidcTokenCustomizerTest {

    private static final String CLIENT_ID = "yacc-frontend";

    private final AsOidcTokenCustomizer customizer = new AsOidcTokenCustomizer();

    private static RegisteredClient registeredClient() {
        return RegisteredClient.withId("registration-1")
                .clientId(CLIENT_ID)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("http://localhost:5173/auth/callback")
                .scope(OidcScopes.OPENID)
                .build();
    }

    private static Authentication principal(UserRole role, UserStatus status,
            boolean mustChangePassword) {
        User user = new User("11111111-1111-1111-1111-111111111111",
                "claims@fixture.yacc.local", "Fixture " + role.getLabel(), "hash",
                role, status, true);
        user.setMustChangePassword(mustChangePassword);
        AuthUser authUser = new AuthUser(user);
        return UsernamePasswordAuthenticationToken.authenticated(authUser, null,
                authUser.getAuthorities());
    }

    private JwtEncodingContext context(Authentication principal, String tokenType,
            Set<String> authorizedScopes) {
        return JwtEncodingContext
                .with(JwsHeader.with(SignatureAlgorithm.RS256),
                        JwtClaimsSet.builder()
                                .issuer("https://as.fixture.local")
                                .issuedAt(Instant.now())
                                .expiresAt(Instant.now().plusSeconds(600))
                                .subject(principal.getName()))
                .registeredClient(registeredClient())
                .principal(principal)
                .authorizationServerContext(new AuthorizationServerContext() {
                    @Override
                    public String getIssuer() {
                        return "https://as.fixture.local";
                    }

                    @Override
                    public AuthorizationServerSettings getAuthorizationServerSettings() {
                        return AuthorizationServerSettings.builder()
                                .issuer("https://as.fixture.local")
                                .build();
                    }
                })
                .tokenType(new OAuth2TokenType(tokenType))
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .authorizedScopes(authorizedScopes)
                .build();
    }

    @Test
    void accessTokensCarryTheMig030RoleAndEmailClaims() {
        JwtEncodingContext context = context(principal(UserRole.MANAGER,
                UserStatus.ACTIVE, false), OAuth2TokenType.ACCESS_TOKEN.getValue(),
                Set.of(OidcScopes.OPENID));

        this.customizer.customize(context);

        assertThat(context.getClaims().build().getClaimAsString("role"))
                .isEqualTo("manager");
        assertThat(context.getClaims().build().getClaimAsString("email"))
                .isEqualTo("claims@fixture.yacc.local");
    }

    @Test
    void idTokensCarryTheScopeConditionalOidcClaims() {
        JwtEncodingContext context = context(principal(UserRole.USER,
                UserStatus.ACTIVE, false), OidcParameterNames.ID_TOKEN,
                Set.of(OidcScopes.OPENID, OidcScopes.PROFILE, OidcScopes.EMAIL));

        this.customizer.customize(context);

        assertThat(context.getClaims().build().getClaimAsString("name"))
                .isEqualTo("Fixture user");
        assertThat(context.getClaims().build().getClaimAsBoolean("email_verified"))
                .isTrue();
    }

    @Test
    void idTokensOmitClaimsOutsideTheGrantedScopes() {
        JwtEncodingContext context = context(principal(UserRole.USER,
                UserStatus.ACTIVE, false), OidcParameterNames.ID_TOKEN,
                Set.of(OidcScopes.OPENID));

        this.customizer.customize(context);

        assertThat(context.getClaims().build().getClaimAsString("name")).isNull();
        assertThat(context.getClaims().build().getClaimAsString("email_verified"))
                .isNull();
    }

    @Test
    void bootstrapIdentitiesSignalMustChangePasswordOnIdTokens() {
        JwtEncodingContext context = context(principal(UserRole.SUPER_ADMIN,
                UserStatus.ACTIVE, true), OidcParameterNames.ID_TOKEN,
                Set.of(OidcScopes.OPENID));

        this.customizer.customize(context);

        assertThat(context.getClaims().build().getClaimAsBoolean(
                "must_change_password")).isTrue();
    }

    @Test
    void nonAuthUserPrincipalsAreLeftUntouched() {
        Authentication foreign = UsernamePasswordAuthenticationToken.authenticated(
                "not-an-authuser", null, List.of());
        JwtEncodingContext context = context(foreign,
                OAuth2TokenType.ACCESS_TOKEN.getValue(), Set.of(OidcScopes.OPENID));

        this.customizer.customize(context);

        assertThat(context.getClaims().build().getClaimAsString("role")).isNull();
        assertThat(context.getClaims().build().getClaimAsString("email")).isNull();
    }
}
