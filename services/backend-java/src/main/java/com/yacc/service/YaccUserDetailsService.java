package com.yacc.service;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.yacc.api.auth.AuthUser;
import com.yacc.entity.User;
import com.yacc.entity.UserStatus;
import com.yacc.repository.UserRepository;

/**
 * Loads identities by email for local authentication (MIG-030; ADR-025).
 *
 * <p>Only {@code ACTIVE} accounts are loadable: an unknown email and a
 * non-active account are indistinguishable
 * {@link UsernameNotFoundException}s at sign-in (anti-enumeration, uniform
 * 401 {@code Invalid credentials} behavior).</p>
 */
@Service
public class YaccUserDetailsService implements UserDetailsService {

    private final UserRepository users;

    public YaccUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = users.findByEmail(email)
                .filter(candidate -> candidate.getStatus() == UserStatus.ACTIVE)
                .orElseThrow(() -> new UsernameNotFoundException(
                        "No active account for " + email));
        return new AuthUser(user);
    }
}
