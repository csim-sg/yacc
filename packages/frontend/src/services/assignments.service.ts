/**
 * Assignments Service
 * Handles conversation assignment operations
 */

import { api } from '../lib/apiClient';

export interface AssignConversationRequest {
  assignedUserId: string | null;
}

export interface Conversation {
  id: string;
  assignedUserId: string | null;
  [key: string]: unknown;
}

export interface AssignResponse {
  data: Conversation;
}

export const assignmentsService = {
  /**
   * Assign a conversation to a user or unassign (set to null)
   * PATCH /api/conversations/:conversationId/assign
   * Backend: manager+ only
   */
  async assign(
    conversationId: string,
    assignedUserId: string | null
  ): Promise<AssignResponse> {
    return api.patch<AssignResponse>(
      `/api/conversations/${conversationId}/assign`,
      { assignedUserId }
    );
  },
};
