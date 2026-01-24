/**
 * Search Schema
 */
import { z } from 'zod';

export const SearchConversationsQuerySchema = z.object({
  q: z.string().min(1),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  channel: z.enum(['irc']).optional(), // Phase 1 MVP: IRC only. Expand to include telegram in Phase 2+
  tagId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
