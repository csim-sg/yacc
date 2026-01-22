import type { z } from 'zod';
import { RoutingRuleStatusEnum } from '../constants/statuses.constant';

export type RoutingRuleStatus = z.infer<typeof RoutingRuleStatusEnum>;
