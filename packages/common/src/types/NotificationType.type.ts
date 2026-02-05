import { z } from 'zod';
import { NotificationTypeEnum } from '../constants/statuses.constant';

export type NotificationType = z.infer<typeof NotificationTypeEnum>;
