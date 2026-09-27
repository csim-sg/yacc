package com.yacc.auth.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.auth.model.PasswordResetToken;

/**
 * Spring Data JPA repository for {@link PasswordResetToken} (MIG-021;
 * ADR-027/ARCH-004 §7).
 */
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Integer> {

    Optional<PasswordResetToken> findByToken(String token);
}
