/**
 * Tags Service
 * Handles tag CRUD operations for conversations
 */

import { api } from '../lib/apiClient';

export interface Tag {
  id: string;
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

export interface AddTagRequest {
  tagId: string;
}

export interface RemoveTagResponse {
  success: boolean;
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
   */
  async addToConversation(
    conversationId: string,
    payload: AddTagRequest
  ): Promise<void> {
    return api.post<void>(
      `/api/conversations/${conversationId}/tags`,
      payload
    );
  },

  /**
   * Remove a tag from a conversation
   */
  async removeFromConversation(
    conversationId: string,
    tagId: string
  ): Promise<RemoveTagResponse> {
    return api.delete<RemoveTagResponse>(
      `/api/conversations/${conversationId}/tags/${tagId}`
    );
  },
};
