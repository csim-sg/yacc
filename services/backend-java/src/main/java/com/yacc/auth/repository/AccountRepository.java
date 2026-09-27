package com.yacc.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.auth.model.Account;

/**
 * Spring Data JPA repository for {@link Account} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface AccountRepository extends JpaRepository<Account, String> {
}
