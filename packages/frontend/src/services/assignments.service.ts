/**
 * Assignments Service
 * Handles conversation assignment operations
 */

import { api } from '../lib/apiClient';

export interface AssignRequest {
  assigneeId: string | null;
}

export interface AssignResponse {
  data: {
    id: string;
    assignedUserId: string | null;
    assignedUserName?: string | null;
    updatedAt: string;
  };
}

export const assignmentsService = {
  /**
   * Assign a conversation to a user or unassign (set to null)
   */
  async assign(
    conversationId: string,
    assigneeId: string | null
  ): Promise<AssignResponse> {
    return api.put<AssignResponse>(
      `/api/conversations/${conversationId}/assign`,
      { assigneeId }
    );
  },
};
