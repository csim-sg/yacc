package com.yacc.auth.service;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.yacc.auth.model.User;
import com.yacc.auth.model.UserPage;
import com.yacc.auth.model.UserRole;
import com.yacc.auth.model.UserStatus;
import com.yacc.auth.repository.UserRepository;

/**
 * Public read/write API of the {@code auth} identity bounded context over
 * the {@code users} table (MIG-040; ADR-030 boundary rule): feature services
 * that need identity data (user administration, mention resolution, sender
 * display names) depend on THIS service, never on the auth repository.
 *
 * <p>Operations are intentionally narrow and free of user-administration
 * policy (self-modification guards, audit) — those live with the calling
 * feature. New credentials are stored bcrypt-hashed; list lookups exclude
 * soft-deleted identities.</p>
 */
@Service
public class UserDirectoryService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserDirectoryService(UserRepository users, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * Lists live (non-deleted) identities, oldest first (POC parity), with
     * optional role/status filters and a case-insensitive email substring
     * search. LIKE wildcards in the search term are escaped (POC parity).
     */
    @Transactional(readOnly = true)
    public UserPage list(int oneIndexedPage, int limit, UserRole role, UserStatus status, String search) {
        Specification<User> spec = UserRepository.IS_NOT_DELETED;
        if (role != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("role"), role));
        }
        if (status != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), status));
        }
        if (search != null && !search.isBlank()) {
            String pattern = "%" + escapeLike(search) + "%";
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("email")),
                    pattern.toLowerCase()));
        }
        var pageable = PageRequest.of(oneIndexedPage - 1, limit,
                Sort.by(Sort.Direction.ASC, "createdAt"));
        var page = users.findAll(spec, pageable);
        return new UserPage(page.getContent(), page.getTotalElements());
    }

    /** Finds a live identity by id (soft-deleted identities read as absent). */
    @Transactional(readOnly = true)
    public Optional<User> findLiveById(String id) {
        return users.findById(id).filter(user -> user.getDeletedAt() == null);
    }

    /** Finds an identity by exact id, including soft-deleted ones. */
    @Transactional(readOnly = true)
    public Optional<User> findById(String id) {
        return users.findById(id);
    }

    /**
     * Resolves a mention (email local-part, case-insensitive) to a live
     * identity — the POC mention-parser contract (first match wins).
     */
    @Transactional(readOnly = true)
    public Optional<User> findByEmailLocalPart(String localPart) {
        return users.findFirstByEmailIgnoreCaseStartingWithAndDeletedAtIsNull(
                localPart + "@");
    }

    /** True when a live identity with this id exists. */
    @Transactional(readOnly = true)
    public boolean existsLiveById(String id) {
        return findLiveById(id).isPresent();
    }

    /** True when any live identity already uses this email (case-insensitive). */
    @Transactional(readOnly = true)
    public boolean existsLiveByEmailIgnoreCase(String email) {
        return users.existsByEmailIgnoreCaseAndDeletedAtIsNull(email);
    }

    /** True when another live identity (different id) uses this email. */
    @Transactional(readOnly = true)
    public boolean existsLiveByEmailIgnoreCaseAndIdNot(String email, String id) {
        return users.existsByEmailIgnoreCaseAndDeletedAtIsNullAndIdNot(email, id);
    }

    /**
     * Creates an identity with a bcrypt-hashed credential (cost 12, POC
     * parity), active status, and unverified email. Caller owns validation
     * and audit. The UUID identity id is generated here (the users table has
     * no default for the text primary key).
     */
    @Transactional
    public User create(String email, String rawPassword, String name, UserRole role,
            UserStatus status, boolean emailVerified) {
        User user = new User(java.util.UUID.randomUUID().toString(), email.toLowerCase(), name,
                passwordEncoder.encode(rawPassword), role, status,
                emailVerified);
        return users.save(user);
    }

    /**
     * Persists partial-field updates (email lowercased, POC parity). The
     * caller decides which fields changed; null fields are left untouched.
     */
    @Transactional
    public User updateFields(User user, String email, String name, UserRole role, UserStatus status) {
        if (email != null) {
            user.setEmail(email.toLowerCase());
        }
        if (name != null) {
            user.setName(name);
        }
        if (role != null) {
            user.setRole(role);
        }
        if (status != null) {
            user.setStatus(status);
        }
        user.setUpdatedAt(LocalDateTime.now());
        return users.save(user);
    }

    /** Soft-deletes an identity (sets deletedAt + updatedAt). */
    @Transactional
    public User softDelete(User user) {
        var now = LocalDateTime.now();
        user.setDeletedAt(now);
        user.setUpdatedAt(now);
        return users.save(user);
    }

    /**
     * Sender display name for outbound messages (POC parity): the email
     * local-part with its first letter capitalized; unknown users render as
     * {@code Unknown User}.
     */
    @Transactional(readOnly = true)
    public String displayName(String userId) {
        return users.findById(userId)
                .map(User::getEmail)
                .map(UserDirectoryService::capitalizeLocalPart)
                .orElse("Unknown User");
    }

    private static String capitalizeLocalPart(String email) {
        String localPart = email.split("@", 2)[0];
        if (localPart.isEmpty()) {
            return "User";
        }
        return Character.toUpperCase(localPart.charAt(0)) + localPart.substring(1);
    }

    /** Escapes LIKE wildcards so user input matches literally (POC parity). */
    private static String escapeLike(String input) {
        return input.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
