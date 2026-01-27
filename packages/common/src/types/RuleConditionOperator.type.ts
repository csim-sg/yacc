import type { z } from 'zod';
import { RuleConditionOperatorEnum } from '../constants/routingRules.constant';

export type RuleConditionOperator = z.infer<typeof RuleConditionOperatorEnum>;
