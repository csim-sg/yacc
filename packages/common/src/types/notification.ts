/**
 * Notification Domain Type
 */

import type { ValueOf } from './utils';

export interface Notification {
  id: string;
  userId: string;
  type: ValueOf<typeof NOTIFICATION_TYPES>;
  conversationId: string;
  actorId?: string;
  actorName?: string;
  isRead: boolean;
  createdAt: string;
}

import { NOTIFICATION_TYPES } from '../constants/statuses';
