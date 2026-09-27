package com.yacc.routingrule.model;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Wire representation of a routing rule (frozen contract component
 * {@code RoutingRule}; condition/action JSON is lenient per ADR-021).
 */
public record RoutingRuleResponse(
        UUID id,
        String name,
        String description,
        String status,
        Integer priority,
        JsonNode conditions,
        JsonNode actions,
        String createdById,
        LocalDateTime lastRunAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    /** JSON-boundary edge: the entity stores conditions/actions as JSON strings. */
    public static RoutingRuleResponse from(com.yacc.routingrule.model.RoutingRule rule,
            com.fasterxml.jackson.databind.ObjectMapper mapper) {
        return new RoutingRuleResponse(
                rule.getId(),
                rule.getName(),
                rule.getDescription(),
                rule.getStatus(),
                rule.getPriority(),
                parse(rule.getConditions(), mapper),
                parse(rule.getActions(), mapper),
                rule.getCreatedById(),
                rule.getLastRunAt(),
                rule.getCreatedAt(),
                rule.getUpdatedAt());
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
