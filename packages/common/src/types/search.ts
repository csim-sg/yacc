/**
 * Search API Types
 */

import type { ValueOf } from './utils';

export interface SearchConversationsQuery {
  q: string;
  page?: number;
  pageSize?: number;
  channel?: ValueOf<typeof CHANNELS>;
  tagId?: string;
  assigneeId?: string;
  status?: ValueOf<typeof CONVERSATION_STATUSES>;
  dateFrom?: string;
  dateTo?: string;
}

import { CHANNELS } from '../constants/channels';
import { CONVERSATION_STATUSES } from '../constants/statuses';
