/**
 * Tag-related TypeScript types and interfaces
 */

export interface CreateTagParams {
  name: string;
  color?: string;
  createdById: string;
}

export interface AddTagToConversationParams {
  conversationId: string;
  tagId: number;
  userId: string;
}

export interface RemoveTagFromConversationParams {
  conversationId: string;
  tagId: number;
  userId: string;
}

export interface TagServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface ConversationTag {
  id: number;
  name: string;
  color: string;
  createdById: string;
  createdAt: Date;
}
