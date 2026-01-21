/**
 * Routing Rule API Types
 */

import type { RuleCondition, RuleAction } from './routing-rule';

export interface CreateRoutingRuleRequest {
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
}

export interface UpdateRoutingRuleRequest {
  name?: string;
  status?: 'active' | 'disabled';
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  priority?: number;
}
