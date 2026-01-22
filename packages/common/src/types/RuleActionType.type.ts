import type { z } from 'zod';
import { RuleActionTypeEnum } from '../constants/routing-rules.constant';

export type RuleActionType = z.infer<typeof RuleActionTypeEnum>;
