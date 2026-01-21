/**
 * Search API Types
 */

export interface SearchConversationsQuery {
  q: string;
  page?: number;
  pageSize?: number;
  channel?: keyof typeof CHANNELS;
  tagId?: string;
  assigneeId?: string;
  status?: keyof typeof CONVERSATION_STATUSES;
  dateFrom?: string;
  dateTo?: string;
}

import { CHANNELS } from '../constants/channels';
import { CONVERSATION_STATUSES } from '../constants/statuses';
