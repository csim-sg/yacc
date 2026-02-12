/**
 * Tags Service
 * Handles tag CRUD operations for conversations
 */

import { api } from '../lib/apiClient';

export interface Tag {
  id: number;
  name: string;
  color: string;
  createdAt: string;
  createdBy: string;
}

export interface CreateTagRequest {
  name: string;
  color: string;
}

export interface CreateTagResponse {
  data: Tag;
}

export interface ListTagsResponse {
  data: Tag[];
}

export interface AttachTagRequest {
  tagId: number;
}

export interface AttachTagResponse {
  data: { tags: Tag[] };
}

export interface DetachTagResponse {
  data: { tags: Tag[] };
}

export const tagsService = {
  /**
   * Get all tags
   */
  async list(): Promise<ListTagsResponse> {
    return api.get<ListTagsResponse>('/api/tags');
  },

  /**
   * Create a new tag
   */
  async create(payload: CreateTagRequest): Promise<CreateTagResponse> {
    return api.post<CreateTagResponse>('/api/tags', payload);
  },

  /**
   * Add a tag to a conversation
   * POST /api/tags/conversations/:conversationId
   */
  async addToConversation(
    conversationId: string,
    payload: AttachTagRequest
  ): Promise<AttachTagResponse> {
    return api.post<AttachTagResponse>(
      `/api/tags/conversations/${conversationId}`,
      payload
    );
  },

  /**
   * Remove a tag from a conversation
   * DELETE /api/tags/conversations/:conversationId/tags/:tagId
   */
  async removeFromConversation(
    conversationId: string,
    tagId: number
  ): Promise<DetachTagResponse> {
    return api.delete<DetachTagResponse>(
      `/api/tags/conversations/${conversationId}/tags/${tagId}`
    );
  },
};
