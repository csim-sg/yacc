package com.yacc.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.auth.model.Verification;

/**
 * Spring Data JPA repository for {@link Verification} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface VerificationRepository extends JpaRepository<Verification, String> {
}
