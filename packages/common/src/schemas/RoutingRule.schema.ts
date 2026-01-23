import { z } from 'zod';
import { RoutingRuleStatusEnum } from '../constants/statuses.constant';
import { RuleConditionSchema } from './RuleCondition.schema';
import { RuleActionSchema } from './RuleAction.schema';

export const RoutingRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  status: RoutingRuleStatusEnum,
  priority: z.number().int().min(0),
  conditions: z.array(RuleConditionSchema),
  actions: z.array(RuleActionSchema),
  lastRunAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
