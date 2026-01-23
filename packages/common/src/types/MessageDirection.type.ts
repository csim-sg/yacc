import type { z } from 'zod';
import { MessageDirectionEnum } from '../constants/statuses.constant';

export type MessageDirection = z.infer<typeof MessageDirectionEnum>;
