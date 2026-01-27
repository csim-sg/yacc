import type { z } from 'zod';
import { RuleConditionFieldEnum } from '../constants/routingRules.constant';

export type RuleConditionField = z.infer<typeof RuleConditionFieldEnum>;
