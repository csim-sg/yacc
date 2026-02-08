import { z } from 'zod';
import { ConversationStatusEnum, PriorityEnum } from '../constants/statuses.constant.js';

export const UpdateConversationRequestSchema = z.object({
  status: ConversationStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  assignedUserId: z.string().uuid().optional(),
});
