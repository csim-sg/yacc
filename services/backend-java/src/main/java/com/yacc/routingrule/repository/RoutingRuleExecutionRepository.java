package com.yacc.routingrule.repository;

import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.yacc.routingrule.model.RoutingRuleExecution;

/**
 * Spring Data JPA repository for {@link RoutingRuleExecution} (MIG-021;
 * ADR-027). Derived queries only — no raw SQL.
 */
public interface RoutingRuleExecutionRepository
        extends JpaRepository<RoutingRuleExecution, Integer> {

    Page<RoutingRuleExecution> findByRuleId(UUID ruleId, Pageable pageable);

    java.util.Optional<RoutingRuleExecution> findByRuleIdAndConversationId(UUID ruleId,
            UUID conversationId);
}
