/**
 * Conversation API Types
 */

import type { Conversation } from './conversation';

export interface GetConversationsQuery {
  page?: number;
  pageSize?: number;
  channel?: 'telegram' | 'irc' | 'whatsapp' | 'twitter';
  assignedUserId?: string;
  status?: 'open' | 'pending' | 'resolved';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateConversationResponse {
  conversation: Conversation;
}

export interface UpdateConversationRequest {
  status?: 'open' | 'pending' | 'resolved';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  assignedUserId?: string;
}
