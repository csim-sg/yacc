import { z } from 'zod';
import { ConversationStatusEnum, PriorityEnum } from '../constants/statuses.constant';

export const UpdateConversationRequestSchema = z.object({
  status: ConversationStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  assignedUserId: z.string().uuid().optional(),
});
