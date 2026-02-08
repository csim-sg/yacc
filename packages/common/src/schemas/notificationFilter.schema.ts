import { z } from 'zod';
import { NotificationTypeEnum } from '../constants/statuses.constant.js';

export const NotificationFilterSchema = z.object({
  unread: z.boolean().optional(),
  type: NotificationTypeEnum.optional(),
});
