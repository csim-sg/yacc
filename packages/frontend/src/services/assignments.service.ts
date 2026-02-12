/**
 * Assignments Service
 * Handles conversation assignment operations
 */

import { api } from '../lib/apiClient';

export interface AssignConversationRequest {
  assignedUserId: string;
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
   * Assign a conversation to a user
   * POST /api/conversations/:conversationId/assign
   * Backend: manager+ only
   * 
   * PHASE 2 MVP: Unassign not supported
   * - Backend requires assignedUserId (non-nullable)
   * - No unassign option in UI (removed to prevent broken actions)
   * - Users must reassign to different user instead
   * - TODO Phase 3: Expose separate unassign endpoint if needed
   */
  async assign(
    conversationId: string,
    assignedUserId: string
  ): Promise<AssignResponse> {
    return api.post<AssignResponse>(
      `/api/conversations/${conversationId}/assign`,
      { assignedUserId }
    );
  },
};
