package com.yacc.auth.repository;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.yacc.auth.model.PasswordResetToken;

/**
 * Spring Data JPA repository for {@link PasswordResetToken} (MIG-021;
 * ADR-027/ARCH-004 §7). Token lookup is hash-based: only the bcrypt digest
 * is stored, so candidate rows are resolved unused-first and matched with
 * the shared {@code PasswordEncoder} (POC parity; MIG-031).
 */
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, Integer> {

    /**
     * All unconsumed tokens — the bcrypt match candidates. At most one
     * active token per identity exists (issuance deletes prior unused rows).
     *
     * @return every token row without a consumption timestamp
     */
    List<PasswordResetToken> findByUsedAtIsNull();

    /**
     * Removes any unconsumed tokens of the identity — the issuance step
     * enforcing one active reset token per user (POC parity).
     *
     * @param userId token owner
     */
    void deleteByUserIdAndUsedAtIsNull(String userId);

    /**
     * Atomically consumes a token row (replay protection): the update
     * applies only while the row is unconsumed, so a single winner marks
     * the token used even under concurrent presents.
     *
     * @param id     token row id
     * @param usedAt consumption timestamp
     * @return 1 when this call consumed the token, 0 when it was already used
     */
    @Modifying
    @Query("update PasswordResetToken t set t.usedAt = :usedAt"
            + " where t.id = :id and t.usedAt is null")
    int markUsed(@Param("id") Integer id, @Param("usedAt") java.time.LocalDateTime usedAt);

    Optional<PasswordResetToken> findByToken(String token);
}
