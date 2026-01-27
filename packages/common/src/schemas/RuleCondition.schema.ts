import { z } from 'zod';
import { RuleConditionFieldEnum, RuleConditionOperatorEnum } from '../constants/routingRules.constant';

export const RuleConditionSchema = z.object({
  field: RuleConditionFieldEnum,
  operator: RuleConditionOperatorEnum,
  value: z.union([z.string(), z.array(z.string())]),
});
