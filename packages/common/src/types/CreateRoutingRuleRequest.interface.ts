import type { RuleCondition } from './RuleCondition.interface';
import type { RuleAction } from './RuleAction.interface';

export interface CreateRoutingRuleRequest {
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
}
