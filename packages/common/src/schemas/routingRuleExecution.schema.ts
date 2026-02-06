import { z } from 'zod';
import { RuleConditionSchema } from './RuleCondition.schema';
import { RuleActionSchema } from './RuleAction.schema';

export const RoutingRuleExecutionSchema = z.object({
  id: z.string().uuid(),
  ruleId: z.string().uuid(),
  conversationId: z.string().uuid(),
  matchedConditions: z.array(RuleConditionSchema),
  appliedActions: z.array(RuleActionSchema),
  createdAt: z.string().datetime(),
});
