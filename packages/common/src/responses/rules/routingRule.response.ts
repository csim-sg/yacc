import type { RoutingRule } from '../../types/routingRule.interface';

/**
 * Routing Rule Response
 * Response shape for routing rule endpoints
 *
 * @see GET /api/rules
 * @see POST /api/rules
 * @see PATCH /api/rules/:id
 */
export interface RoutingRuleResponse extends RoutingRule {
  /** Number of times this rule has been executed (optional, for list views) */
  executionCount?: number;
}
