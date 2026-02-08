import { z } from 'zod';
import { ChannelEnum, ConversationStatusEnum, PriorityEnum } from '../constants/statuses.constant.js';

export const GetConversationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  channel: ChannelEnum.optional(),
  assignedUserId: z.string().uuid().optional(),
  status: ConversationStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  tagId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
