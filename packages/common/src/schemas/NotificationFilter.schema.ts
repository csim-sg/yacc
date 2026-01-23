import { z } from 'zod';
import { NotificationTypeEnum } from '../constants/statuses.constant';

export const NotificationFilterSchema = z.object({
  unread: z.boolean().optional(),
  type: NotificationTypeEnum.optional(),
});
