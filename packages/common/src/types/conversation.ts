/**
 * Conversation Domain Type
 */

import type { User } from './user';
import type { Tag } from './tag';

export interface Conversation {
  id: string;
  channel: 'telegram' | 'irc' | 'whatsapp' | 'twitter';
  externalThreadId: string;
  status: 'open' | 'pending' | 'resolved';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignedUserId?: string;
  assignedUser?: User;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}
