/**
 * Notes Service
 * Handles note CRUD operations with @mention support
 */

import { api } from '../lib/apiClient';

export interface Note {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  body: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  body: string;
  mentions?: string[];
}

export interface CreateNoteResponse {
  data: Note;
}

export interface ListNotesResponse {
  data: Note[];
}

export const notesService = {
  /**
   * Get all notes for a conversation
   */
  async list(conversationId: string): Promise<ListNotesResponse> {
    return api.get<ListNotesResponse>(`/api/conversations/${conversationId}/notes`);
  },

  /**
   * Create a new note with optional @mentions
   * @mention format: @username or @[userId]
   */
  async create(
    conversationId: string,
    payload: CreateNoteRequest
  ): Promise<CreateNoteResponse> {
    return api.post<CreateNoteResponse>(
      `/api/conversations/${conversationId}/notes`,
      payload
    );
  },
};
