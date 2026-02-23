/**
 * Tags Types
 * Backend-specific types for tag operations
 *
 * For shared types, use:
 * - Tag from '@yacc/common/types/Tag.interface'
 * - TagResponse from '@yacc/common/responses/tags/tag.response'
 * - CreateTagRequest from '@yacc/common/requests/tags/createTag.request'
 */

/**
 * Create Tag Request
 * @deprecated Use CreateTagRequest from '@yacc/common/requests/tags/createTag.request'
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
 * @deprecated Use TagResponse from '@yacc/common/responses/tags/tag.response'
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
