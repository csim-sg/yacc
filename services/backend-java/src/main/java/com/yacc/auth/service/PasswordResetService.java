package com.yacc.auth.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.yacc.auth.AuthProperties;
import com.yacc.auth.model.PasswordResetToken;
import com.yacc.auth.model.User;
import com.yacc.auth.repository.PasswordResetTokenRepository;
import com.yacc.auth.repository.UserRepository;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * Password-reset flow (MIG-031; frozen contract {@code authForgotPassword} /
 * {@code authResetPassword}; BE-003 parity). Token policy is founder-fixed
 * parity: a 256-bit {@link SecureRandom} value (64-char hex) delivered only
 * by email, stored solely as a bcrypt digest of the shared
 * {@link PasswordEncoder} — no bespoke token crypto (ARCH-004 §8); expiring
 * after the configured TTL (60m default); single-use with atomic
 * consumption so a replayed token is rejected; at most one active token per
 * identity (issuance deletes prior unused rows).
 *
 * <p>Completion is the ordinary-identity account-recovery path: the
 * credential is replaced fresh (no old-credential restore), the
 * forced-password-change flag is cleared, and every refresh grant is
 * revoked so other clients must re-authenticate. Each step is audit-logged
 * with the POC action vocabulary.</p>
 */
@Service
public class PasswordResetService {

    /** 32 random bytes = 256 bits of token entropy (BE-003 parity). */
    private static final int TOKEN_BYTES = 32;

    private final UserRepository users;
    private final PasswordResetTokenRepository resetTokens;
    private final PasswordEncoder passwordEncoder;
    private final SessionService sessions;
    private final AuthEmailService emails;
    private final AuthProperties properties;
    private final AuditPersistence audit;
    private final SecureRandom random = new SecureRandom();

    public PasswordResetService(UserRepository users,
            PasswordResetTokenRepository resetTokens,
            PasswordEncoder passwordEncoder,
            SessionService sessions,
            AuthEmailService emails,
            AuthProperties properties,
            AuditPersistence audit) {
        this.users = users;
        this.resetTokens = resetTokens;
        this.passwordEncoder = passwordEncoder;
        this.sessions = sessions;
        this.emails = emails;
        this.properties = properties;
        this.audit = audit;
    }

    /**
     * Initiates a reset for the address (frozen contract
     * {@code authForgotPassword}). Unknown addresses are a silent no-op —
     * the controller answers the constant anti-enumeration message
     * regardless. Known addresses get a fresh single-use token and the
     * reset email (delivery retries, then audits failure without failing
     * this flow).
     *
     * @param email address a reset was requested for
     */
    @Transactional
    public void initiate(String email) {
        Optional<User> found = users.findByEmail(email);
        if (found.isEmpty()) {
            return;
        }
        User user = found.get();
        resetTokens.deleteByUserIdAndUsedAtIsNull(user.getId());

        String token = newToken();
        LocalDateTime expiresAt = LocalDateTime.now()
                .plus(properties.passwordReset().tokenTtl());
        resetTokens.save(new PasswordResetToken(user.getId(),
                passwordEncoder.encode(token), expiresAt));
        audit.persist(new AuditRecord("password.reset_token_generated", "user",
                user.getId(), user.getId(), null, java.time.Instant.now()));

        emails.sendPasswordResetEmail(user.getEmail(), token);
    }

    /**
     * Completes a reset with the emailed token (frozen contract
     * {@code authResetPassword}). Unknown, malformed, expired, and already
     * consumed tokens all fail with the same generic
     * {@link InvalidTokenException} (anti-enumeration); a valid token is
     * consumed atomically and the fresh credential is set.
     *
     * @param token       raw token from the email link
     * @param newPassword replacement credential
     * @throws InvalidTokenException for every invalid-token reason
     */
    @Transactional
    public void complete(String token, String newPassword) {
        PasswordResetToken record = findValidUnused(token);
        LocalDateTime now = LocalDateTime.now();
        if (resetTokens.markUsed(record.getId(), now) == 0) {
            // Lost a consumption race — the token is already used.
            throw new InvalidTokenException();
        }
        audit.persist(new AuditRecord("password.reset_token_validated", "user",
                record.getUserId(), record.getUserId(), null, java.time.Instant.now()));

        User user = users.findById(record.getUserId()).orElseThrow(InvalidTokenException::new);
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setMustChangePassword(false);
        user.setUpdatedAt(now);
        users.save(user);
        sessions.revokeAllForUser(user.getId());
        audit.persist(new AuditRecord("password.reset_successful", "user",
                user.getId(), user.getId(), null, java.time.Instant.now()));
    }

    private PasswordResetToken findValidUnused(String token) {
        if (token == null || !token.matches("[0-9a-f]{64}")) {
            throw new InvalidTokenException();
        }
        for (PasswordResetToken candidate : resetTokens.findByUsedAtIsNull()) {
            if (!passwordEncoder.matches(token, candidate.getToken())) {
                continue;
            }
            if (candidate.getExpiresAt().isBefore(LocalDateTime.now())) {
                throw new InvalidTokenException();
            }
            return candidate;
        }
        throw new InvalidTokenException();
    }

    private String newToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
