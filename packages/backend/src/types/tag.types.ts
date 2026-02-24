/**
 * Tag Service Types
 * Internal types for tag service operations
 *
 * For shared types, use:
 * - Tag from '@yacc/common/types/Tag.interface'
 * - TagResponse from '@yacc/common/responses/tags/tag.response'
 * - CreateTagRequest from '@yacc/common/requests/tags/createTag.request'
 */

/**
 * Parameters for creating a tag (internal service use)
 */
export interface CreateTagParams {
  name: string;
  color?: string;
  createdById: string;
}

/**
 * Parameters for adding a tag to a conversation
 */
export interface AddTagToConversationParams {
  conversationId: string;
  tagId: number;
  userId: string;
}

/**
 * Parameters for removing a tag from a conversation
 */
export interface RemoveTagFromConversationParams {
  conversationId: string;
  tagId: number;
  userId: string;
}

/**
 * Generic result type for tag service operations
 */
export interface TagServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * ConversationTag - internal representation
 * @deprecated Use Tag from '@yacc/common/types/Tag.interface'
 */
export interface ConversationTag {
  id: number;
  name: string;
  color: string;
  createdById: string;
  createdAt: Date;
}
