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
  status?: keyof typeof ROUTING_RULE_STATUSES;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  priority?: number;
}

import { ROUTING_RULE_STATUSES } from '../constants/statuses';
