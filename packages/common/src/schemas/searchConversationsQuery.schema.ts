import { z } from 'zod';
import { ChannelEnum, ConversationStatusEnum } from '../constants/statuses.constant';

export const SearchConversationsQuerySchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
  channel: ChannelEnum.optional(),
  tagId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  status: ConversationStatusEnum.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
