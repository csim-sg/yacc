import type { z } from 'zod';
import { RuleConditionOperatorEnum } from '../constants/routing-rules.constant';

export type RuleConditionOperator = z.infer<typeof RuleConditionOperatorEnum>;
