/**
 * Collaboration API Types
 */

export interface AddTagRequest {
  tagId: string;
}

export interface CreateNoteRequest {
  body: string;
}

export interface AssignConversationRequest {
  assignedUserId: string;
}

export interface BulkActionRequest {
  conversationIds: string[];
  action: 'assign' | 'tag' | 'changeStatus' | 'changePriority';
  data: {
    assignedUserId?: string;
    tagId?: string;
    status?: keyof typeof CONVERSATION_STATUSES;
    priority?: keyof typeof PRIORITY_LEVELS;
  };
}

export interface BulkActionResponse {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}

import { CONVERSATION_STATUSES, PRIORITY_LEVELS } from '../constants/statuses';
