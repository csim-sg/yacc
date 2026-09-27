package com.yacc.auth.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.oidc.IdTokenClaimNames;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

/**
 * Unit tests for the MIG-032 RP principal ({@link YaccOidcUser}): the single
 * YACC authority from the persisted role, the user-id principal name, and
 * claim delegation to the external identity.
 */
class YaccOidcUserTest {

    private static OidcUser external() {
        OidcIdToken idToken = new OidcIdToken("token-value", Instant.now(),
                Instant.now().plusSeconds(300),
                Map.of(IdTokenClaimNames.SUB, "sub-123",
                        "email", "person@fixture.yacc.local"));
        return new DefaultOidcUser(List.of(new SimpleGrantedAuthority("ROLE_EXTERNAL")),
                idToken);
    }

    @Test
    void exposesTheYaccIdentityNotTheIdpAuthorities() {
        User user = new User("user-1", "person@fixture.yacc.local", "Person",
                "hash", UserRole.MANAGER, UserStatus.ACTIVE, true);
        YaccOidcUser principal = new YaccOidcUser(user, external());

        assertThat(principal.getAuthorities())
                .containsExactly(new SimpleGrantedAuthority("ROLE_MANAGER"));
        assertThat(principal.getName()).isEqualTo("user-1");
        assertThat(principal.user()).isSameAs(user);
    }

    @Test
    void delegatesClaimsAndTokensToTheExternalIdentity() {
        OidcUser externalUser = external();
        User user = new User("user-1", "person@fixture.yacc.local", "Person",
                "hash", UserRole.USER, UserStatus.ACTIVE, true);
        YaccOidcUser principal = new YaccOidcUser(user, externalUser);

        assertThat(principal.getClaims()).containsEntry(IdTokenClaimNames.SUB, "sub-123");
        assertThat(principal.getAttributes()).containsEntry(IdTokenClaimNames.SUB, "sub-123");
        assertThat(principal.getIdToken()).isSameAs(externalUser.getIdToken());
        assertThat(principal.getUserInfo()).isNull(); // no user-info endpoint configured
    }
}
