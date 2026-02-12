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
   * Assign a conversation to a user
   * POST /api/conversations/:conversationId/assign
   * Backend: manager+ only
   * 
   * LIMITATION (Phase 2 MVP): Backend requires assignedUserId (cannot be null)
   * - Manager users CAN assign conversations
   * - Manager users CANNOT unassign (backend validation fails if assignedUserId is null)
   * - Only admin+ can unassign via PATCH /api/conversations/:id/assign
   * 
   * TODO Phase 3: Either fix backend validation to allow null, or expose unassign as separate endpoint
   */
  async assign(
    conversationId: string,
    assignedUserId: string | null
  ): Promise<AssignResponse> {
    if (!assignedUserId) {
      throw new Error('Backend does not support unassign for manager role. Contact admin to unassign.');
    }
    return api.post<AssignResponse>(
      `/api/conversations/${conversationId}/assign`,
      { assignedUserId }
    );
  },
};
