/**
 * Tags Types
 * Type definitions for tag creation and tag-related operations
 */

export interface CreateTagRequest {
  name: string;
  color?: string;
}

/**
 * Attach Tag to Conversation Request
 */
export interface AttachTagRequest {
  tagId: number;
}

/**
 * Tag Response DTO
 */
export interface TagResponse {
  id: number;
  name: string;
  color: string;
  createdById: string;
  createdAt: string;
}

/**
 * Conversation with Tags Response
 */
export interface ConversationWithTagsResponse {
  tags: TagResponse[];
}
