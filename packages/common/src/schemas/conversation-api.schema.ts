/**
 * Get Conversations Query Schema
 */
import { z } from 'zod';

export const GetConversationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  channel: z
    .enum(['telegram', 'irc', 'whatsapp', 'wechat', 'meta', 'x', 'email', 'slack'])
    .optional(),
  assignedUserId: z.string().uuid().optional(),
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  tagId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export const UpdateConversationRequestSchema = z.object({
  status: z.enum(['open', 'pending', 'resolved']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedUserId: z.string().uuid().optional(),
});
