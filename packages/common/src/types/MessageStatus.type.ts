import type { z } from 'zod';
import { MessageStatusEnum } from '../constants/statuses.constant';

export type MessageStatus = z.infer<typeof MessageStatusEnum>;
