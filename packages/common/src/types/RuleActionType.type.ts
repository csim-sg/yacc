import { z } from 'zod';
import { RuleActionTypeEnum } from '../constants/routingRules.constant.js';

export type RuleActionType = z.infer<typeof RuleActionTypeEnum>;
