package com.yacc.auth.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.auth.model.Session;

/**
 * Spring Data JPA repository for {@link Session} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface SessionRepository extends JpaRepository<Session, String> {

    Optional<Session> findByToken(String token);
}
