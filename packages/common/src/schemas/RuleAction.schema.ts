import { z } from 'zod';
import { RuleActionTypeEnum } from '../constants/routing-rules.constant';

export const RuleActionSchema = z.object({
  type: RuleActionTypeEnum,
  value: z.string(),
});
