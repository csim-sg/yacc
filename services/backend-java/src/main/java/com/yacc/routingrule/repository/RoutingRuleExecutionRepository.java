package com.yacc.routingrule.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.yacc.routingrule.model.RoutingRuleExecution;

/**
 * Spring Data JPA repository for {@link RoutingRuleExecution} (MIG-021;
 * ADR-027/ARCH-004 §7).
 */
public interface RoutingRuleExecutionRepository extends JpaRepository<RoutingRuleExecution, Integer> {
}
