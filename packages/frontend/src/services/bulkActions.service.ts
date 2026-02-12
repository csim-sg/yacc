/**
 * Bulk Actions Service
 * Handles bulk operations on conversations
 */

import { api } from '../lib/apiClient';

export type BulkActionType = 'assign' | 'tag' | 'status';

export type BulkActionData =
  | { assigneeId: string }
  | { tagId: number }
  | { status: 'open' | 'pending' | 'resolved' };

export interface BulkActionFailure {
  id: string;
  reason: string;
}

export interface BulkActionResponseData {
  successCount: number;
  failureCount: number;
  failures: BulkActionFailure[];
}

export interface BulkActionResponse {
  data: BulkActionResponseData;
}

export interface BulkActionRequest {
  conversationIds: string[];
  action: BulkActionType;
  data: BulkActionData;
}

export const bulkActionsService = {
  /**
   * Perform bulk actions on conversations
   * POST /api/conversations/bulk
   * @param conversationIds - Array of conversation IDs to update
   * @param action - Type of action: 'assign', 'tag', or 'status'
   * @param data - Action-specific data (assigneeId for assign, tagId for tag, status for status)
   * Response: { data: { successCount, failureCount, failures } }
   */
  async execute(
    conversationIds: string[],
    action: BulkActionType,
    data: BulkActionData
  ): Promise<BulkActionResponse> {
    const payload: BulkActionRequest = {
      conversationIds,
      action,
      data,
    };

    return api.post<BulkActionResponse>('/api/conversations/bulk', payload);
  },

  /**
   * Bulk assign conversations to a user
   * PHASE 2 MVP: Unassign not supported
   * - assigneeId is required (non-nullable)
   * - No null/unassign option exposed in UI
   */
  async bulkAssign(
    conversationIds: string[],
    assigneeId: string
  ): Promise<BulkActionResponse> {
    return this.execute(conversationIds, 'assign', { assigneeId });
  },

  /**
   * Bulk tag conversations
   */
  async bulkTag(
    conversationIds: string[],
    tagId: number
  ): Promise<BulkActionResponse> {
    return this.execute(conversationIds, 'tag', { tagId });
  },

  /**
   * Bulk update conversation status
   */
  async bulkUpdateStatus(
    conversationIds: string[],
    status: 'open' | 'pending' | 'resolved'
  ): Promise<BulkActionResponse> {
    return this.execute(conversationIds, 'status', { status });
  },
};
