import { z } from 'zod';
import { NotificationTypeEnum } from '../constants/statuses.constant';

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  type: NotificationTypeEnum,
  conversationId: z.string().uuid(),
  actorId: z.string().uuid().optional(),
  actorName: z.string().optional(),
  body: z.string(),
  isRead: z.boolean(),
  readAt: z.string().datetime().optional(),
  dismissedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
