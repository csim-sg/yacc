import type { Channel } from './Channel.type';
import type { ConversationStatus } from './ConversationStatus.type';
import type { Priority } from './Priority.type';

export interface ConversationFilter {
  channel?: Channel;
  status?: ConversationStatus;
  assignedUserId?: string;
  tags?: string[];
  priority?: Priority;
  searchText?: string;
  dateFrom?: string;
  dateTo?: string;
}
