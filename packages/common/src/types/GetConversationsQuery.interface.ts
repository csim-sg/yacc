import type { Channel } from './Channel.type';
import type { ConversationStatus } from './ConversationStatus.type';
import type { Priority } from './Priority.type';

export interface GetConversationsQuery {
  page?: number;
  pageSize?: number;
  channel?: Channel;
  assignedUserId?: string;
  status?: ConversationStatus;
  priority?: Priority;
  tagId?: string;
  dateFrom?: string;
  dateTo?: string;
}
