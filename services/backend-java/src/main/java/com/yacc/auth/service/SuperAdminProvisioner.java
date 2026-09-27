package com.yacc.auth.service;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.UserRepository;

/**
 * Creates and re-provisions the deterministic Super Admin identity
 * (MIG-030; ADR-025). Shared by the first-run bootstrap and the
 * founder-controlled recovery — the only two paths by which a SUPER_ADMIN
 * exists.
 *
 * <p>Determinism: the identity is keyed by its email — the uuid is derived
 * from a fixed name-based (RFC 4122 v3) derivation over the bootstrap
 * namespace and the email, so the same inputs always yield the same
 * identity. The initial credential is hashed with the standard bcrypt
 * encoder and is always delivered one-time from env/secret; no old
 * credential is ever restored.</p>
 */
@Service
public class SuperAdminProvisioner {

    private static final String ID_NAMESPACE = "bootstrap:";

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public SuperAdminProvisioner(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Creates the Super Admin identity (or re-provisions an existing row of
     * the same email). The result is always exactly one SUPER_ADMIN with
     * {@code active} status, verified email, and the forced-password-change
     * flag set.
     *
     * @param email            bootstrap Super Admin email
     * @param initialCredential one-time initial credential (hashed, never logged)
     * @return the persisted identity
     */
    @Transactional
    public User provision(String email, String initialCredential) {
        String id = deterministicId(email);
        User user = users.findById(id).orElseGet(() -> {
            User created = new User(id, email, "Super Admin", null,
                    UserRole.SUPER_ADMIN, UserStatus.ACTIVE, true);
            created.setMustChangePassword(true);
            return created;
        });
        user.setRole(UserRole.SUPER_ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        user.setMustChangePassword(true);
        user.setPasswordHash(passwordEncoder.encode(initialCredential));
        return users.save(user);
    }

    /**
     * Derives the stable identity uuid from the bootstrap email (RFC 4122
     * v3 name-based uuid over the JDK builtin, MD5 — identifier derivation
     * only, not a security control).
     */
    private static String deterministicId(String email) {
        return UUID.nameUUIDFromBytes(
                (ID_NAMESPACE + email.toLowerCase()).getBytes(StandardCharsets.UTF_8))
                .toString();
    }
}
