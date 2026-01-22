import type { z } from 'zod';
import { PriorityEnum } from '../constants/statuses.constant';

export type Priority = z.infer<typeof PriorityEnum>;
