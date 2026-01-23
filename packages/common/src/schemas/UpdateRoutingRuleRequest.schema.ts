import { z } from 'zod';
import { RoutingRuleStatusEnum } from '../constants/statuses.constant';
import { RuleConditionSchema } from './RuleCondition.schema';
import { RuleActionSchema } from './RuleAction.schema';

export const UpdateRoutingRuleRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: RoutingRuleStatusEnum.optional(),
  conditions: z.array(RuleConditionSchema).optional(),
  actions: z.array(RuleActionSchema).optional(),
  priority: z.number().int().min(0).optional(),
});
