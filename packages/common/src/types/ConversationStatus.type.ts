import type { z } from 'zod';
import { ConversationStatusEnum } from '../constants/statuses.constant';

export type ConversationStatus = z.infer<typeof ConversationStatusEnum>;
