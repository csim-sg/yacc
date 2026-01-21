/**
 * Conversation Domain Type
 */

import type { User } from './user';
import type { Tag } from './tag';

export interface Conversation {
  id: string;
  channel: keyof typeof CHANNELS;
  externalThreadId: string;
  status: keyof typeof CONVERSATION_STATUSES;
  priority: keyof typeof PRIORITY_LEVELS;
  assignedUserId?: string;
  assignedUser?: User;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

import { CHANNELS } from '../constants/channels';
import { CONVERSATION_STATUSES, PRIORITY_LEVELS } from '../constants/statuses';