package com.yacc.routingrule.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.routingrule.model.RoutingRule;

/**
 * Spring Data JPA repository for {@link RoutingRule} (MIG-021; ADR-027/ARCH-004 §7).
 */
public interface RoutingRuleRepository extends JpaRepository<RoutingRule, java.util.UUID> {
}
