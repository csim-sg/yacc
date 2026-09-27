package com.yacc.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.yacc.auth.model.Verification;

/**
 * Spring Data JPA repository for {@link Verification} (MIG-021; ADR-027/
 * ARCH-004 §7). Verification challenges are consumed by deletion, so an
 * unresolvable row is the replay-proof state (MIG-031).
 */
public interface VerificationRepository extends JpaRepository<Verification, String> {

    /**
     * Removes any outstanding challenges for the identifier — the issuance
     * step enforcing one active verification token per address.
     *
     * @param identifier challenge identifier (the account email)
     */
    void deleteByIdentifier(String identifier);
}
