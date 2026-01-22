import type { ConversationStatus } from './ConversationStatus.type';
import type { Priority } from './Priority.type';

export interface BulkActionRequest {
  conversationIds: string[];
  action: 'assign' | 'tag' | 'changeStatus' | 'changePriority';
  data: {
    assignedUserId?: string;
    tagId?: string;
    status?: ConversationStatus;
    priority?: Priority;
  };
}
