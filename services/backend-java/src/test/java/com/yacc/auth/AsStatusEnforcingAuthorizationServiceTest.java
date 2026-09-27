package com.yacc.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.InMemoryOAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;

import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.UserRepository;
import com.yacc.auth.service.TokenAuthenticationService;

/**
 * Unit tests for the status-enforcing AS grant-store seam (MIG-033 review
 * loop 1; ADR-025): every {@code findByToken} resolution re-checks the
 * authorization owner's persisted status, and a grant whose owner is
 * missing or not {@code ACTIVE} is invisible to every grant flow — exactly
 * like a missing grant.
 */
@ExtendWith(MockitoExtension.class)
class AsStatusEnforcingAuthorizationServiceTest {

    private static final OAuth2TokenType ACCESS_TOKEN_TYPE = OAuth2TokenType.ACCESS_TOKEN;
    private static final OAuth2TokenType REFRESH_TOKEN_TYPE = OAuth2TokenType.REFRESH_TOKEN;

    @Mock
    private UserRepository users;

    private InMemoryOAuth2AuthorizationService store;

    private AsStatusEnforcingAuthorizationService service;

    @BeforeEach
    void setUp() {
        this.store = new InMemoryOAuth2AuthorizationService();
        this.service = new AsStatusEnforcingAuthorizationService(store,
                new TokenAuthenticationService(users));
    }

    private static OAuth2Authorization authorizationWithTokens(String principalName) {
        Instant issuedAt = Instant.now();
        RegisteredClient client = RegisteredClient.withId("client-1")
                .clientId("yacc-frontend")
                .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("http://localhost:5173/auth/callback")
                .build();
        return OAuth2Authorization.withRegisteredClient(client)
                .id("grant-1")
                .principalName(principalName)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .token(new OAuth2AccessToken(OAuth2AccessToken.TokenType.BEARER,
                        "access-value", issuedAt, issuedAt.plusSeconds(300)))
                .token(new OAuth2RefreshToken("refresh-value",
                        issuedAt, issuedAt.plusSeconds(3600)))
                .build();
    }

    private void ownerHasStatus(String id, UserStatus status) {
        when(users.findById(id)).thenReturn(Optional.of(new User(id,
                id + "@fixture.yacc.local", "Fixture", "hash",
                UserRole.USER, status, true)));
    }

    @Test
    void resolvesGrantForActiveOwner() {
        store.save(authorizationWithTokens("owner-1"));
        ownerHasStatus("owner-1", UserStatus.ACTIVE);

        assertThat(service.findByToken("access-value", ACCESS_TOKEN_TYPE)).isNotNull();
        assertThat(service.findByToken("refresh-value", REFRESH_TOKEN_TYPE)).isNotNull();
    }

    @Test
    void hidesGrantWhenOwnerIsSuspended() {
        store.save(authorizationWithTokens("owner-2"));
        ownerHasStatus("owner-2", UserStatus.SUSPENDED);

        assertThat(service.findByToken("access-value", ACCESS_TOKEN_TYPE)).isNull();
        assertThat(service.findByToken("refresh-value", REFRESH_TOKEN_TYPE)).isNull();
    }

    @Test
    void hidesGrantWhenOwnerIsInactive() {
        store.save(authorizationWithTokens("owner-3"));
        ownerHasStatus("owner-3", UserStatus.INACTIVE);

        assertThat(service.findByToken("refresh-value", REFRESH_TOKEN_TYPE)).isNull();
    }

    @Test
    void hidesGrantWhenOwnerNoLongerExists() {
        store.save(authorizationWithTokens("ghost"));
        when(users.findById("ghost")).thenReturn(Optional.empty());

        assertThat(service.findByToken("refresh-value", REFRESH_TOKEN_TYPE)).isNull();
    }

    @Test
    void missingGrantStaysMissingWithoutTouchingTheSeam() {
        assertThat(service.findByToken("absent", REFRESH_TOKEN_TYPE)).isNull();
        verify(users, never()).findById(anyString());
    }

    @Test
    void saveAndRemoveDelegate() {
        OAuth2Authorization authorization = authorizationWithTokens("owner-4");
        ownerHasStatus("owner-4", UserStatus.ACTIVE);

        service.save(authorization);
        assertThat(service.findByToken("refresh-value", REFRESH_TOKEN_TYPE)).isNotNull();

        service.remove(authorization);
        assertThat(service.findByToken("refresh-value", REFRESH_TOKEN_TYPE)).isNull();
    }
}
