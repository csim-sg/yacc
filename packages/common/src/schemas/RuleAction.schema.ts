import { z } from 'zod';
import { RuleActionTypeEnum } from '../constants/routingRules.constant';

export const RuleActionSchema = z.object({
  type: RuleActionTypeEnum,
  value: z.string(),
});
