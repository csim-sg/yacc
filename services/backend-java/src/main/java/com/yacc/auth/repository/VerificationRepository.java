package com.yacc.auth.repository;

import java.time.LocalDateTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.yacc.auth.model.Verification;

/**
 * Spring Data JPA repository for {@link Verification} (MIG-021; ADR-027/
 * ARCH-004 §7). Verification challenges are consumed by deletion, so an
 * unresolvable row is the replay-proof state (MIG-031); the consumption
 * delete is atomic so concurrent confirmations elect a single winner
 * (password-reset {@code markUsed} parity).
 */
public interface VerificationRepository extends JpaRepository<Verification, String> {

    /**
     * Removes any outstanding challenges for the identifier — the issuance
     * step enforcing one active verification token per address.
     *
     * @param identifier challenge identifier (the account email)
     */
    void deleteByIdentifier(String identifier);

    /**
     * Atomically consumes a challenge row (replay protection): the delete
     * applies only while the challenge is unexpired, so a single winner
     * consumes it even under concurrent confirmations — every loser sees
     * zero affected rows and must reject (password-reset {@code markUsed}
     * parity).
     *
     * @param id  challenge row id
     * @param now consumption timestamp
     * @return 1 when this call consumed the challenge, 0 when it was already
     *         consumed or expired
     */
    @Modifying
    @Query("delete from Verification v where v.id = :id and v.expiresAt > :now")
    int deleteUnexpiredById(@Param("id") String id, @Param("now") LocalDateTime now);
}
