import type { z } from 'zod';
import { RuleConditionFieldEnum } from '../constants/routing-rules.constant';

export type RuleConditionField = z.infer<typeof RuleConditionFieldEnum>;
