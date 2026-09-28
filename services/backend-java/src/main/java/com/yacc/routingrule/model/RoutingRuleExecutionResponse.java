package com.yacc.routingrule.model;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Wire representation of a rule execution log entry (POC
 * {@code routingRuleExecutions} row shape).
 */
public record RoutingRuleExecutionResponse(
        Integer id,
        UUID ruleId,
        UUID conversationId,
        JsonNode matchedConditions,
        JsonNode appliedActions,
        LocalDateTime createdAt) {

    /** JSON-boundary edge: the entity stores condition/action JSON as strings. */
    public static RoutingRuleExecutionResponse from(
            com.yacc.routingrule.model.RoutingRuleExecution execution,
            com.fasterxml.jackson.databind.ObjectMapper mapper) {
        return new RoutingRuleExecutionResponse(
                execution.getId(),
                execution.getRuleId(),
                execution.getConversationId(),
                parse(execution.getMatchedConditions(), mapper),
                parse(execution.getAppliedActions(), mapper),
                execution.getCreatedAt());
    }

    private static JsonNode parse(String json, com.fasterxml.jackson.databind.ObjectMapper mapper) {
        if (json == null) {
            return null;
        }
        try {
            return mapper.readTree(json);
        } catch (java.io.IOException ignored) {
            return null;
        }
    }
}
