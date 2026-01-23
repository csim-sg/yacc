import type { RuleCondition } from './RuleCondition.interface';
import type { RuleAction } from './RuleAction.interface';

export interface RoutingRuleExecution {
  id: string;
  ruleId: string;
  conversationId: string;
  matchedConditions: RuleCondition[];
  appliedActions: RuleAction[];
  createdAt: string;
}
