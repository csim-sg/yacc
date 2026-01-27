/**
 * Routing Rule Domain Types
 */

import type { ValueOf } from './utils';

export interface RoutingRule {
  id: string;
  name: string;
  status: ValueOf<typeof ROUTING_RULE_STATUSES>;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuleCondition {
  field: 'channel' | 'keyword' | 'sender' | 'tag' | 'time';
  operator: 'eq' | 'in' | 'contains' | 'matches' | 'gt' | 'lt';
  value: string | string[];
}

export interface RuleAction {
  type: 'assign' | 'tag' | 'priority';
  value: string;
}

import { ROUTING_RULE_STATUSES } from '../constants/statuses';
