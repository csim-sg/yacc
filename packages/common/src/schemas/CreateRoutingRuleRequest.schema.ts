import { z } from 'zod';
import { RuleConditionSchema } from './RuleCondition.schema';
import { RuleActionSchema } from './RuleAction.schema';

export const CreateRoutingRuleRequestSchema = z.object({
  name: z.string().min(1).max(255),
  conditions: z.array(RuleConditionSchema),
  actions: z.array(RuleActionSchema),
  priority: z.number().int().min(0),
});
