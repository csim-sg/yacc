package com.yacc.auth.service;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.stereotype.Service;

import com.yacc.auth.model.AuthUser;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.UserRepository;

/**
 * Validates a stateless JWT access token into an authenticated
 * {@link AuthUser}, enforcing account status (MIG-030; ADR-025).
 *
 * <p>This is the single status-enforcement seam shared by every integration
 * point that presents a bearer token: the REST resource server (via
 * {@link BearerTokenAuthenticationConverter}) uses it per request, and the
 * raw WebSocket handshake interceptor (MIG-050, ledger WS-BHV-016) reuses it
 * to validate the handshake token, enforce {@code ACTIVE} status, and attach
 * the principal before session establishment. Inactive and suspended
 * accounts are denied everywhere (ADR-025).</p>
 */
@Service
public class TokenAuthenticationService {

    private final UserRepository users;

    public TokenAuthenticationService(UserRepository users) {
        this.users = users;
    }

    /**
     * Resolves a verified access token to the authenticated identity.
     *
     * @param accessToken decoded access token (subject = user id)
     * @return the authenticated principal
     * @throws InvalidBearerTokenException when the identity no longer exists
     *         or its status is not {@code ACTIVE} — denied with 401, never
     *         silently accepted
     */
    public AuthUser authenticate(Jwt accessToken) {
        return requireActive(accessToken.getSubject());
    }

    /**
     * Resolves a persisted identity by id and enforces {@code ACTIVE}
     * status — the status policy for integration points that hold the
     * owner's id without a bearer token (the AS grant store reloads the
     * authorization owner through this seam before refresh, revocation,
     * code exchange, and userinfo resolution; ADR-025).
     *
     * @param userId the persisted identity id
     * @return the authenticated principal
     * @throws InvalidBearerTokenException when the identity no longer exists
     *         or its status is not {@code ACTIVE} — denied, never silently
     *         accepted
     */
    public AuthUser requireActive(String userId) {
        User user = users.findById(userId).orElse(null);
        if (user == null) {
            throw new InvalidBearerTokenException("Unknown identity");
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new InvalidBearerTokenException("User account is inactive or suspended");
        }
        return new AuthUser(user);
    }
}
