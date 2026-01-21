/**
 * Conversation API Types
 */

import type { Conversation } from './conversation';
import type { ValueOf } from './utils';

export interface GetConversationsQuery {
  page?: number;
  pageSize?: number;
  channel?: ValueOf<typeof CHANNELS>;
  assignedUserId?: string;
  status?: ValueOf<typeof CONVERSATION_STATUSES>;
  priority?: ValueOf<typeof PRIORITY_LEVELS>;
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateConversationResponse {
  conversation: Conversation;
}

export interface UpdateConversationRequest {
  status?: ValueOf<typeof CONVERSATION_STATUSES>;
  priority?: ValueOf<typeof PRIORITY_LEVELS>;
  assignedUserId?: string;
}

import { CHANNELS } from '../constants/channels';
import { CONVERSATION_STATUSES, PRIORITY_LEVELS } from '../constants/statuses';
