package com.yacc.routingrule.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.yacc.routingrule.model.RoutingRule;
import com.yacc.routingrule.model.RoutingRuleExecution;

/**
 * Spring Data JPA repositories for the routing-rule bounded context
 * (MIG-021; ADR-027). Derived queries only — no raw SQL.
 */
public interface RoutingRuleRepository extends JpaRepository<RoutingRule, UUID> {

    List<RoutingRule> findByOrderByPriorityAsc();
}

