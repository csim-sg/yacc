package com.yacc.auth.repository;

import java.util.Optional;

import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;

/**
 * Spring Data JPA repository for {@link User} (MIG-021; ADR-027/ARCH-004 §7).
 * Derived queries + specifications only — no raw SQL.
 */
public interface UserRepository extends JpaRepository<User, String>, JpaSpecificationExecutor<User> {

    /** Specification matching live (non-soft-deleted) identities. */
    Specification<User> IS_NOT_DELETED = (root, query, cb) -> cb.isNull(root.get("deletedAt"));

    Optional<User> findByEmail(String email);

    boolean existsByRole(UserRole role);

    boolean existsByEmailIgnoreCaseAndDeletedAtIsNull(String email);

    boolean existsByEmailIgnoreCaseAndDeletedAtIsNullAndIdNot(String email, String id);

    Optional<User> findFirstByEmailIgnoreCaseStartingWithAndDeletedAtIsNull(String emailPrefix);
}
