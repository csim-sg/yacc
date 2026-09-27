package com.yacc.routingrule.model;

import java.util.List;

/**
 * One execution-log page.
 *
 * @param items page items
 * @param total all executions of the rule
 * @param page  1-indexed page
 * @param limit page size
 */
public record ExecutionPage(List<RoutingRuleExecution> items,
        long total, int page, int limit) {
}
