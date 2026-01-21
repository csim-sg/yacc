/**
 * Notification Domain Type
 */

export interface Notification {
  id: string;
  userId: string;
  type: keyof typeof NOTIFICATION_TYPES;
  conversationId: string;
  actorId?: string;
  actorName?: string;
  isRead: boolean;
  createdAt: string;
}

import { NOTIFICATION_TYPES } from '../constants/statuses';
