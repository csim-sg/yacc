package com.yacc.auth.model;

import java.util.List;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

/**
 * The authenticated YACC identity (MIG-030; ADR-025). Wraps the {@link User}
 * entity as a Spring Security {@link UserDetails} principal: the username is
 * the user id, the single authority is the mapped {@code ROLE_<ROLE>}
 * (uppercase Spring authority; the wire enum stays lowercase per the frozen
 * contract), and account state derives from {@link UserStatus} — only
 * {@code ACTIVE} accounts are enabled.
 *
 * <p>No role inheritance exists (tech-lead guardrail): each role maps to
 * exactly one authority and privileged gates list their allowed roles
 * explicitly.</p>
 */
public class AuthUser implements UserDetails {

    private final User user;

    public AuthUser(User user) {
        this.user = user;
    }

    /** The persisted identity (never the raw credential). */
    public User user() {
        return user;
    }

    public String getId() {
        return user.getId();
    }

    public String getEmail() {
        return user.getEmail();
    }

    public UserRole getRole() {
        return user.getRole();
    }

    public UserStatus getStatus() {
        return user.getStatus();
    }

    public boolean isMustChangePassword() {
        return user.isMustChangePassword();
    }

    @Override
    public List<GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }

    @Override
    public String getPassword() {
        return user.getPasswordHash();
    }

    /** Username is the user id — audit events and principals key on it. */
    @Override
    public String getUsername() {
        return user.getId();
    }

    /** Only ACTIVE accounts may authenticate (ADR-025 status enforcement). */
    @Override
    public boolean isEnabled() {
        return user.getStatus() == UserStatus.ACTIVE;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return user.getStatus() == UserStatus.ACTIVE;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }
}
