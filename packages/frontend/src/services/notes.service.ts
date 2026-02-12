/**
 * Notes Service
 * Handles note CRUD operations with @mention support
 */

import { api } from '../lib/apiClient';

export interface Note {
  id: string;
  conversationId: string;
  authorId: string;
  body: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  body: string;
}

export interface CreateNoteResponse {
  data: Note;
}

export interface ListNotesResponse {
  data: Note[];
  page: number;
  pageSize: number;
  total: number;
}

export const notesService = {
  /**
   * Get all notes for a conversation with pagination
   * GET /api/conversations/:conversationId/notes?page=1&pageSize=50
   */
  async list(
    conversationId: string,
    page: number = 1,
    pageSize: number = 50
  ): Promise<ListNotesResponse> {
    return api.get<ListNotesResponse>(
      `/api/conversations/${conversationId}/notes?page=${page}&pageSize=${pageSize}`
    );
  },

  /**
   * Create a new note
   * POST /api/conversations/:conversationId/notes
   * Body: { body: string }
   * Backend parses @mentions server-side from body text
   * @mention format: @username (no spaces, matches email local-part)
   * Response includes parsed mentions array
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
