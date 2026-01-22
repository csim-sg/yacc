import { z } from 'zod';
import { ConversationStatusEnum, PriorityEnum } from '../constants/statuses.constant';

export const BulkActionRequestSchema = z.object({
  conversationIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['assign', 'tag', 'changeStatus', 'changePriority']),
  data: z.object({
    assignedUserId: z.string().uuid().optional(),
    tagId: z.string().uuid().optional(),
    status: ConversationStatusEnum.optional(),
    priority: PriorityEnum.optional(),
  }),
});
