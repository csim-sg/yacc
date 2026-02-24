import type { Timestamp } from './Timestamp.interface';
import type { RoutingRuleStatus } from './RoutingRuleStatus.type';
import type { RuleCondition } from './RuleCondition.interface';
import type { RuleAction } from './RuleAction.interface';

/**
 * Routing Rule Entity
 * Auto-assign, auto-tag, auto-prioritize based on conditions
 * Rules evaluated in priority order; first match wins
 *
 * @see POST /api/rules - CreateRoutingRuleRequest
 * @see GET /api/rules - List routing rules
 * @see PATCH /api/rules/:id - UpdateRoutingRuleRequest
 */
export interface RoutingRule extends Timestamp {
  /** Unique identifier (UUID) */
  id: string;
  /** Rule display name */
  name: string;
  /** Rule description (optional) */
  description?: string;
  /** Rule status (active or disabled) */
  status: RoutingRuleStatus;
  /** Priority order (lower = higher priority, evaluated first) */
  priority: number;
  /** Array of conditions to match (first match wins) */
  conditions: RuleCondition[];
  /** Array of actions to apply when conditions match */
  actions: RuleAction[];
  /** ISO8601 timestamp when rule was last executed */
  lastRunAt?: string;
}
