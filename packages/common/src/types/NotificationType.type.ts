import { z } from 'zod';
import { NotificationTypeEnum } from '../constants/statuses.constant.js';

export type NotificationType = z.infer<typeof NotificationTypeEnum>;
