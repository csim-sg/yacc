package com.yacc.routingrule.model;

import com.fasterxml.jackson.databind.JsonNode;

import jakarta.validation.constraints.Size;

/**
 * Create/update body (frozen contract component {@code RoutingRuleWrite}).
 * Per ADR-021 (as amended, MIG-005) the rule JSON is LENIENT at creation —
 * {@code conditions}/{@code actions} accept any valid JSON and are validated
 * only on referenced entities (tags, users) and at evaluation time. Create
 * requires name and priority; PATCH treats every field as optional (POC
 * parity, enforced in the service).
 *
 * @param name rule name (≤255 — POC parity)
 * @param description optional description
 * @param status active | disabled (default active)
 * @param priority 0..9999, lower runs first
 * @param conditions lenient condition JSON (documented boundary)
 * @param actions lenient action JSON (documented boundary)
 */
public record RoutingRuleWrite(
        @Size(max = 255) String name,
        String description,
        String status,
        Integer priority,
        JsonNode conditions,
        JsonNode actions) {

    /** Validates the frozen priority band (POC parity) when provided. */
    public void assertPriorityInRange() {
        if (priority != null && (priority < 0 || priority > 9999)) {
            throw new com.yacc.common.controller.BadRequestException(
                    "Priority must be between 0 and 9999");
        }
    }

    /** Normalizes the status to its stored value. */
    public String statusOrDefault() {
        return status == null ? "active" : status;
    }
}
