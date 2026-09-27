package com.yacc.auth.model;

import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.OidcUserInfo;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

/**
 * The authenticated YACC identity produced by the OIDC relying-party login
 * (MIG-032; ADR-025 RP role; TR-05 {@code oauth2Login} + explicit linking).
 *
 * <p>Wraps the external IdP identity (claims of the resolved
 * {@code OidcUser}) as a Spring Security {@link OidcUser} principal whose
 * authorities are the resolved YACC {@code ROLE_<ROLE>} — exactly one
 * authority per user (no role inheritance), mirroring {@link AuthUser}. The
 * principal name is the YACC user id, so security audit events and
 * {@code SecurityContext} consumers key on the YACC identity, never the IdP
 * subject.</p>
 */
public class YaccOidcUser implements OidcUser {

    private final User user;

    private final OidcUser external;

    public YaccOidcUser(User user, OidcUser external) {
        this.user = user;
        this.external = external;
    }

    /** The resolved, explicitly linked YACC identity. */
    public User user() {
        return user;
    }

    /** The external IdP claims carrier (ID-token / user-info claims). */
    public OidcUser external() {
        return external;
    }

    /** The single YACC authority from the persisted role — never the IdP's. */
    @Override
    public List<GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    /** Username is the YACC user id — audit events and principals key on it. */
    @Override
    public String getName() {
        return user.getId();
    }

    @Override
    public Map<String, Object> getClaims() {
        return external.getClaims();
    }

    @Override
    public OidcUserInfo getUserInfo() {
        return external.getUserInfo();
    }

    @Override
    public OidcIdToken getIdToken() {
        return external.getIdToken();
    }

    @Override
    public Map<String, Object> getAttributes() {
        return external.getAttributes();
    }
}
