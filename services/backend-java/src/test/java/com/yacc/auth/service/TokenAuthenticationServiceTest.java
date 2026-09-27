package com.yacc.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;

import com.yacc.auth.model.AuthUser;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.UserRepository;

/**
 * Unit tests for the shared bearer-token authentication seam (AC-MIG-030-3;
 * ADR-025): authorities map from the persisted role, and inactive/suspended
 * identities are denied — the same enforcement the raw WebSocket handshake
 * reuses (MIG-050).
 */
@ExtendWith(MockitoExtension.class)
class TokenAuthenticationServiceTest {

    @Mock
    private UserRepository users;

    private TokenAuthenticationService service;

    @BeforeEach
    void setUp() {
        service = new TokenAuthenticationService(users);
    }

    private static Jwt tokenFor(String subject) {
        return Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .claims(map -> map.putAll(Map.of("role", "user")))
                .build();
    }

    @Test
    void authenticatesActiveIdentityWithRoleAuthority() {
        User active = new User("user-1", "user@fixture.yacc.local", "Fixture",
                "hash", UserRole.MANAGER, UserStatus.ACTIVE, true);
        when(users.findById("user-1")).thenReturn(Optional.of(active));

        AuthUser authenticated = service.authenticate(tokenFor("user-1"));

        assertThat(authenticated.getId()).isEqualTo("user-1");
        assertThat(authenticated.getAuthorities())
                .containsExactly(new SimpleGrantedAuthority("ROLE_MANAGER"));
    }

    @Test
    void deniesInactiveIdentity() {
        User inactive = new User("user-2", "user2@fixture.yacc.local", "Fixture",
                "hash", UserRole.USER, UserStatus.INACTIVE, true);
        when(users.findById("user-2")).thenReturn(Optional.of(inactive));

        assertThatThrownBy(() -> service.authenticate(tokenFor("user-2")))
                .isInstanceOf(InvalidBearerTokenException.class)
                .hasMessageContaining("inactive");
    }

    @Test
    void deniesSuspendedIdentity() {
        User suspended = new User("user-3", "user3@fixture.yacc.local", "Fixture",
                "hash", UserRole.ADMIN, UserStatus.SUSPENDED, true);
        when(users.findById("user-3")).thenReturn(Optional.of(suspended));

        assertThatThrownBy(() -> service.authenticate(tokenFor("user-3")))
                .isInstanceOf(InvalidBearerTokenException.class)
                .hasMessageContaining("suspended");
    }

    @Test
    void deniesUnknownIdentity() {
        when(users.findById(any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.authenticate(tokenFor("ghost")))
                .isInstanceOf(InvalidBearerTokenException.class);
    }
}
