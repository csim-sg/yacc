package com.yacc.auth.service;

import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.yacc.auth.model.Account;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.AccountRepository;
import com.yacc.auth.repository.UserRepository;
import com.yacc.audit.model.AuditRecord;
import com.yacc.audit.service.AuditPersistence;

/**
 * OIDC relying-party identity resolution with explicit account linking
 * (MIG-032; ADR-025 RP role; ARCH-004 §8; TR-05). One deterministic,
 * fail-closed rule set — fixed policy lives here, not in callers:
 *
 * <ol>
 *   <li>an existing explicit link ({@code account} row keyed by the IdP
 *       registration id + subject) resolves to its YACC user;</li>
 *   <li>otherwise a verified IdP e-mail that matches an existing user creates
 *       the explicit link — no silent merge beyond the deterministic
 *       e-mail rule;</li>
 *   <li>otherwise a brand-new {@code USER}-role identity is provisioned and
 *       linked — self-elevation is impossible; privileged provisioning stays
 *       SUPER_ADMIN-only;</li>
 *   <li>a linked or matched identity whose status is not {@code ACTIVE} is
 *       denied (status enforcement on the RP entry point);</li>
 *   <li>a missing or unverified external e-mail cannot establish a link and
 *       is denied (fail-closed);</li>
 *   <li>every outcome is audit-logged (POC action vocabulary extension:
 *       {@code user.oidc.linked}, {@code user.oidc.provisioned}; denials use
 *       {@code user.login.failed}).</li>
 * </ol>
 *
 * <p>Provisioned identities receive an unusable local credential (bcrypt of a
 * random value via the shared {@link PasswordEncoder}) — no bespoke token
 * crypto, and local sign-in remains impossible until a password is set
 * through the approved recovery/credential flows.</p>
 */
@Service
public class OidcIdentityService {

    /** Audit action for a newly created explicit link. */
    public static final String ACTION_OIDC_LINKED = "user.oidc.linked";

    /** Audit action for a first-login provisioning via the IdP. */
    public static final String ACTION_OIDC_PROVISIONED = "user.oidc.provisioned";

    /** Generic denial reason (wire message stays uniform — anti-enumeration). */
    private static final String DENIAL_ERROR = "invalid_identity";

    private final UserRepository users;

    private final AccountRepository accounts;

    private final PasswordEncoder passwordEncoder;

    private final AuditPersistence audit;

    private final ObjectMapper mapper;

    public OidcIdentityService(UserRepository users, AccountRepository accounts,
            PasswordEncoder passwordEncoder, AuditPersistence audit, ObjectMapper mapper) {
        this.users = users;
        this.accounts = accounts;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
        this.mapper = mapper;
    }

    /**
     * Resolves (or explicitly links/provisions) the YACC identity for an
     * authenticated external IdP identity.
     *
     * @param providerId registration id of the configured IdP
     * @param external   the external identity resolved from the ID token
     * @return the ACTIVE YACC user the external identity is bound to
     * @throws OAuth2AuthenticationException when the identity cannot be
     *         resolved under the rules above (denied, never silently accepted)
     */
    @Transactional
    public User resolve(String providerId, OidcUser external) {
        String subject = external.getSubject();

        Account link = accounts.findByProviderIdAndAccountId(providerId, subject).orElse(null);
        if (link != null) {
            User linked = users.findById(link.getUserId()).orElse(null);
            if (linked == null) {
                // Broken link (identity row removed without its links):
                // fail closed — the dangling link never authenticates.
                throw denied(providerId, "broken_link");
            }
            return touch(activeUserOrDeny(linked, providerId));
        }

        String email = external.getEmail();
        if (email == null || email.isBlank() || !Boolean.TRUE.equals(external.getEmailVerified())) {
            throw denied(providerId, "unverified_external_email");
        }

        User existing = users.findByEmail(email).orElse(null);
        if (existing != null) {
            // Explicit link by the deterministic verified-e-mail rule — only
            // ACTIVE identities may claim the match; nothing is linked for
            // inactive/suspended accounts (fail-closed before linking).
            User active = activeUserOrDeny(existing, providerId);
            createLink(active.getId(), providerId, subject);
            audit.persist(new AuditRecord(ACTION_OIDC_LINKED, "user", active.getId(),
                    active.getId(), metadata(providerId), java.time.Instant.now()));
            return touch(active);
        }

        User provisioned = new User(
                UUID.randomUUID().toString(),
                email,
                displayName(external),
                // Unusable local credential: local sign-in stays impossible.
                passwordEncoder.encode(UUID.randomUUID().toString()),
                UserRole.USER,
                UserStatus.ACTIVE,
                true);
        provisioned = users.save(provisioned);
        audit.persist(new AuditRecord(ACTION_OIDC_PROVISIONED, "user", provisioned.getId(),
                provisioned.getId(), metadata(providerId), java.time.Instant.now()));
        createLink(provisioned.getId(), providerId, subject);
        audit.persist(new AuditRecord(ACTION_OIDC_LINKED, "user", provisioned.getId(),
                provisioned.getId(), metadata(providerId), java.time.Instant.now()));
        return provisioned;
    }

    private User activeUserOrDeny(User user, String providerId) {
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw denied(providerId, "user_not_active");
        }
        return user;
    }

    private OAuth2AuthenticationException denied(String providerId, String reason) {
        ObjectNode metadata = metadata(providerId);
        metadata.put("reason", reason);
        // The reason lands in the audit trail only; the wire response is the
        // uniform frozen 401 body (anti-enumeration).
        audit.persist(new AuditRecord("user.login.failed", "user", null, null,
                metadata, java.time.Instant.now()));
        return new OAuth2AuthenticationException(new OAuth2Error(DENIAL_ERROR),
                "Authentication failed");
    }

    private ObjectNode metadata(String providerId) {
        ObjectNode node = mapper.createObjectNode();
        node.put("provider", providerId);
        return node;
    }

    private static String displayName(OidcUser external) {
        String name = external.getFullName();
        if (name == null || name.isBlank()) {
            name = external.getPreferredUsername();
        }
        if (name == null || name.isBlank()) {
            name = external.getEmail();
        }
        return name;
    }

    private void createLink(String userId, String providerId, String subject) {
        accounts.save(new Account(UUID.randomUUID().toString(), userId, subject, providerId));
    }

    private User touch(User user) {
        user.setLastLoginAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        return users.save(user);
    }
}
