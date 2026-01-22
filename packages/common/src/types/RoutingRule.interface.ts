import type { Timestamp } from './Timestamp.interface';
import type { RoutingRuleStatus } from './RoutingRuleStatus.type';
import type { RuleCondition } from './RuleCondition.interface';
import type { RuleAction } from './RuleAction.interface';

export interface RoutingRule extends Timestamp {
  id: string;
  name: string;
  status: RoutingRuleStatus;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  lastRunAt?: string;
}
