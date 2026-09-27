package com.yacc.auth.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.auth.AuthProperties;
import com.yacc.auth.model.Session;
import com.yacc.auth.model.User;
import com.yacc.auth.repository.SessionRepository;

/**
 * Refresh-grant lifecycle (MIG-030; ADR-025 stateless JWT access + refresh
 * default). Grants are opaque 256-bit {@link SecureRandom} values persisted
 * as {@code session} rows (MIG-021 table); presented grants are rotated
 * (new row, old row revoked) and sign-out revokes the presented grant.
 */
@Service
public class SessionService {

    /** 32 random bytes = 256 bits of grant entropy. */
    private static final int GRANT_BYTES = 32;

    private final SessionRepository sessions;
    private final AuthProperties.Token tokenPolicy;
    private final SecureRandom random = new SecureRandom();

    public SessionService(SessionRepository sessions, AuthProperties properties) {
        this.sessions = sessions;
        this.tokenPolicy = properties.token();
    }

    /**
     * Issues a fresh refresh grant for the identity.
     *
     * @param user grant owner
     * @return the persisted grant (opaque token + id + expiry)
     */
    @Transactional
    public Session issue(User user) {
        LocalDateTime now = LocalDateTime.now();
        Session session = new Session(
                java.util.UUID.randomUUID().toString(),
                user.getId(),
                now.plus(tokenPolicy.refreshTtl()),
                newGrant());
        return sessions.save(session);
    }

    /**
     * Resolves a presented grant if it exists and has not expired.
     *
     * @param token presented opaque grant
     * @return the grant row, empty when unknown or expired
     */
    @Transactional(readOnly = true)
    public Optional<Session> findValid(String token) {
        return sessions.findByToken(token)
                .filter(session -> session.getExpiresAt().isAfter(LocalDateTime.now()));
    }

    /**
     * Rotates a presented grant: revokes it and issues a fresh one.
     *
     * @param presented the grant being rotated out
     * @param user      grant owner
     * @return the fresh grant
     */
    @Transactional
    public Session rotate(Session presented, User user) {
        sessions.delete(presented);
        return issue(user);
    }

    /**
     * Revokes a single grant owned by the identity (sign-out). Grants of
     * other owners are never revoked.
     *
     * @param sessionId grant id ({@code sid} claim of the presented access token)
     * @param ownerId   authenticated identity id
     */
    @Transactional
    public void revoke(String sessionId, String ownerId) {
        sessions.findById(sessionId)
                .filter(session -> session.getUserId().equals(ownerId))
                .ifPresent(sessions::delete);
    }

    /**
     * Revokes every grant of an identity (credential replacement).
     *
     * @param userId grant owner
     */
    @Transactional
    public void revokeAllForUser(String userId) {
        sessions.deleteByUserId(userId);
    }

    private String newGrant() {
        byte[] bytes = new byte[GRANT_BYTES];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
