import { z } from 'zod';
import { RuleActionTypeEnum } from '../constants/routingRules.constant';

export type RuleActionType = z.infer<typeof RuleActionTypeEnum>;
