package com.yacc.auth.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.auth.model.User;
import com.yacc.auth.model.UserRole;

/**
 * Spring Data JPA repository for {@link User} (MIG-021; ADR-027/ARCH-004 §7).
 * Derived queries only — no raw SQL.
 */
public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByEmail(String email);

    boolean existsByRole(UserRole role);
}
