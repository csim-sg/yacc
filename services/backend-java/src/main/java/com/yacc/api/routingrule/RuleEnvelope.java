package com.yacc.api.routingrule;

/**
 * Single-rule envelope {@code {data: RoutingRule}}.
 *
 * @param data the rule
 */
public record RuleEnvelope(RoutingRuleResponse data) {
}
