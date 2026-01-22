import type { Channel } from './Channel.type';
import type { ConversationStatus } from './ConversationStatus.type';

export interface SearchConversationsQuery {
  q: string;
  page?: number;
  pageSize?: number;
  channel?: Channel;
  tagId?: string;
  assigneeId?: string;
  status?: ConversationStatus;
  dateFrom?: string;
  dateTo?: string;
}
