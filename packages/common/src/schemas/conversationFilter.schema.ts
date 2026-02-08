import { z } from 'zod';
import { ChannelEnum, ConversationStatusEnum, PriorityEnum } from '../constants/statuses.constant.js';

export const ConversationFilterSchema = z.object({
  channel: ChannelEnum.optional(),
  status: ConversationStatusEnum.optional(),
  assignedUserId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  priority: PriorityEnum.optional(),
  searchText: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
