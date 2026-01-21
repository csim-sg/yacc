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
    status?: 'open' | 'pending' | 'resolved';
    priority?: 'low' | 'normal' | 'high' | 'urgent';
  };
}

export interface BulkActionResponse {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}
