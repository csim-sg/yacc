import { z } from 'zod';
import { RuleConditionFieldEnum, RuleConditionOperatorEnum } from '../constants/routing-rules.constant';

export const RuleConditionSchema = z.object({
  field: RuleConditionFieldEnum,
  operator: RuleConditionOperatorEnum,
  value: z.union([z.string(), z.array(z.string())]),
});
