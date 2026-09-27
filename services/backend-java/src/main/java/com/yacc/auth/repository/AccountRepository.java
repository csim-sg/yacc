package com.yacc.auth.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

import com.yacc.auth.model.Account;

/**
 * Spring Data JPA repository for {@link Account} (MIG-021; ADR-027/ARCH-004 §7).
 * The {@code (provider_id, account_id)} unique index (V1 baseline) backs the
 * MIG-032 explicit OIDC link lookup — one external IdP identity links to at
 * most one YACC user.
 */
public interface AccountRepository extends JpaRepository<Account, String> {

    /**
     * Resolves the explicit link for an external IdP identity.
     *
     * @param providerId registration id of the IdP (e.g. the founder-named IdP)
     * @param accountId  the IdP subject claim ({@code sub})
     * @return the link row, empty when the external identity is not linked
     */
    Optional<Account> findByProviderIdAndAccountId(String providerId, String accountId);
}
