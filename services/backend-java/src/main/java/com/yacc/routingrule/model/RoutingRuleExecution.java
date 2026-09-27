package com.yacc.routingrule.model;

import java.time.LocalDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA entity for the {@code routing_rule_executions} table (MIG-021; V1
 * baseline, ADR-027). FK columns (rule_id, conversation_id) are plain typed
 * columns (ADR-030); JSON columns map as raw JSON strings.
 */
@Entity
@Table(name = "routing_rule_executions")
public class RoutingRuleExecution {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id", nullable = false, updatable = false)
    private Integer id;

    @Column(name = "rule_id", nullable = false, updatable = false)
    private UUID ruleId;

    @Column(name = "conversation_id", nullable = false, updatable = false)
    private UUID conversationId;

    @Column(name = "matched_conditions")
    private String matchedConditions;

    @Column(name = "applied_actions")
    private String appliedActions;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected RoutingRuleExecution() {
        // JPA
    }

    public RoutingRuleExecution(UUID ruleId, UUID conversationId,
                                String matchedConditions, String appliedActions) {
        this.ruleId = ruleId;
        this.conversationId = conversationId;
        this.matchedConditions = matchedConditions;
        this.appliedActions = appliedActions;
        this.createdAt = LocalDateTime.now();
    }

    public Integer getId() {
        return id;
    }

    public UUID getRuleId() {
        return ruleId;
    }

    public UUID getConversationId() {
        return conversationId;
    }

    public String getMatchedConditions() {
        return matchedConditions;
    }

    public String getAppliedActions() {
        return appliedActions;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setMatchedConditions(String matchedConditions) {
        this.matchedConditions = matchedConditions;
    }

    public void setAppliedActions(String appliedActions) {
        this.appliedActions = appliedActions;
    }
}
