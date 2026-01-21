/**
 * Conversation API Types
 */

import type { Conversation } from './conversation';

export interface GetConversationsQuery {
  page?: number;
  pageSize?: number;
  channel?: keyof typeof CHANNELS;
  assignedUserId?: string;
  status?: keyof typeof CONVERSATION_STATUSES;
  priority?: keyof typeof PRIORITY_LEVELS;
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateConversationResponse {
  conversation: Conversation;
}

export interface UpdateConversationRequest {
  status?: keyof typeof CONVERSATION_STATUSES;
  priority?: keyof typeof PRIORITY_LEVELS;
  assignedUserId?: string;
}

import { CHANNELS } from '../constants/channels';
import { CONVERSATION_STATUSES, PRIORITY_LEVELS } from '../constants/statuses';
