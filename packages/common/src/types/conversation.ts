/**
 * Conversation Domain Type
 */

import type { User } from './user';
import type { Tag } from './tag';
import type { ValueOf } from './utils';

export interface Conversation {
  id: string;
  channel: ValueOf<typeof CHANNELS>;
  externalThreadId: string;
  status: ValueOf<typeof CONVERSATION_STATUSES>;
  priority: ValueOf<typeof PRIORITY_LEVELS>;
  assignedUserId?: string;
  assignedUser?: User;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

import { CHANNELS } from '../constants/channels';
import { CONVERSATION_STATUSES, PRIORITY_LEVELS } from '../constants/statuses';