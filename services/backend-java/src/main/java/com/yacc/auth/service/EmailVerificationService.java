package com.yacc.auth.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.crypto.password.PasswordEncoder;

import com.yacc.auth.AuthProperties;
import com.yacc.auth.model.User;
import com.yacc.auth.model.Verification;
import com.yacc.auth.repository.UserRepository;
import com.yacc.auth.repository.VerificationRepository;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * Email-verification flow (MIG-031; ADR-025 identity lifecycle). The
 * challenge is issued when an ordinary identity self-registers: a 256-bit
 * {@link SecureRandom} token (64-char hex) emailed as an action link and
 * persisted solely as a bcrypt digest in the {@code verification} table
 * (no bespoke token crypto, ARCH-004 §8). Confirmation consumes the
 * challenge with an atomic conditional delete — a single winner under
 * concurrent confirmations, mirroring the reset flow's {@code markUsed}
 * — and only the winner flips {@code email_verified} and audit-logs the
 * event; losers and replays find nothing left to consume and fail with
 * the generic error.
 * At most one active challenge per address exists (issuance deletes prior
 * rows).
 */
@Service
public class EmailVerificationService {

    /** 32 random bytes = 256 bits of token entropy (reset-token parity). */
    private static final int TOKEN_BYTES = 32;

    private final UserRepository users;
    private final VerificationRepository verifications;
    private final PasswordEncoder passwordEncoder;
    private final AuthEmailService emails;
    private final AuthProperties properties;
    private final AuditPersistence audit;
    private final SecureRandom random = new SecureRandom();

    public EmailVerificationService(UserRepository users,
            VerificationRepository verifications,
            PasswordEncoder passwordEncoder,
            AuthEmailService emails,
            AuthProperties properties,
            AuditPersistence audit) {
        this.users = users;
        this.verifications = verifications;
        this.passwordEncoder = passwordEncoder;
        this.emails = emails;
        this.properties = properties;
        this.audit = audit;
    }

    /**
     * Issues the verification challenge for a freshly registered identity
     * and sends the verification email (delivery retries, then audits
     * failure without failing the caller — sign-up is never broken by a
     * mail outage).
     *
     * @param user the newly registered identity
     */
    @Transactional
    public void issue(User user) {
        verifications.deleteByIdentifier(user.getEmail());
        String token = newToken();
        LocalDateTime expiresAt = LocalDateTime.now()
                .plus(properties.emailVerification().tokenTtl());
        verifications.save(new Verification(UUID.randomUUID().toString(),
                user.getEmail(), passwordEncoder.encode(token), expiresAt));
        audit.persist(new AuditRecord("email.verification_token_generated", "user",
                user.getId(), user.getId(), null, java.time.Instant.now()));

        emails.sendVerificationEmail(user.getEmail(), token);
    }

    /**
     * Confirms an email address with the emailed token. Unknown,
     * malformed, expired, already consumed, and race-lost tokens all fail
     * with the same generic {@link InvalidTokenException}
     * (anti-enumeration). Consumption is an atomic conditional delete: a
     * single winner under concurrent confirmations, and only the winner
     * flips {@code email_verified} and emits the success audit.
     *
     * @param token raw token from the email link
     * @throws InvalidTokenException for every invalid-token reason
     */
    @Transactional
    public void confirm(String token) {
        if (token == null || !token.matches("[0-9a-f]{64}")) {
            throw new InvalidTokenException();
        }
        Verification match = null;
        for (Verification candidate : verifications.findAll()) {
            if (passwordEncoder.matches(token, candidate.getValue())) {
                if (candidate.getExpiresAt().isBefore(LocalDateTime.now())) {
                    throw new InvalidTokenException();
                }
                match = candidate;
                break;
            }
        }
        if (match == null) {
            throw new InvalidTokenException();
        }
        // Single-winner consumption by deletion: concurrent confirmations
        // of the same challenge elect one winner; a replayed token (and any
        // racer that lost) deletes nothing and is rejected.
        if (verifications.deleteUnexpiredById(match.getId(), LocalDateTime.now()) == 0) {
            throw new InvalidTokenException();
        }
        User user = users.findByEmail(match.getIdentifier())
                .orElseThrow(InvalidTokenException::new);
        user.setEmailVerified(true);
        user.setUpdatedAt(LocalDateTime.now());
        users.save(user);
        audit.persist(new AuditRecord("email.verification_successful", "user",
                user.getId(), user.getId(), null, java.time.Instant.now()));
    }

    private String newToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
