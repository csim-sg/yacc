import type { RuleCondition } from './RuleCondition.interface';
import type { RuleAction } from './RuleAction.interface';
import type { RoutingRuleStatus } from './RoutingRuleStatus.type';

export interface UpdateRoutingRuleRequest {
  name?: string;
  status?: RoutingRuleStatus;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
  priority?: number;
}
