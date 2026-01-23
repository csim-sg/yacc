import type { ConversationStatus } from './ConversationStatus.type';
import type { Priority } from './Priority.type';

export interface UpdateConversationRequest {
  status?: ConversationStatus;
  priority?: Priority;
  assignedUserId?: string;
}
