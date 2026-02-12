/**
 * Bulk Actions Service
 * Handles bulk operations on conversations
 */

import { api } from '../lib/apiClient';

export type BulkActionType = 'assign' | 'tag' | 'status';

export interface BulkActionData {
  assign?: string | null;
  tag?: string;
  status?: 'open' | 'pending' | 'resolved';
}

export interface BulkActionFailure {
  id: string;
  reason: string;
}

export interface BulkActionResponse {
  successCount: number;
  failureCount: number;
  failures: BulkActionFailure[];
}

export interface BulkActionRequest {
  conversationIds: string[];
  action: BulkActionType;
  data: BulkActionData;
}

export const bulkActionsService = {
  /**
   * Perform bulk actions on conversations
   * @param conversationIds - Array of conversation IDs to update
   * @param action - Type of action: 'assign', 'tag', or 'status'
   * @param data - Action-specific data (assigneeId for assign, tagId for tag, status for status)
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
   */
  async bulkAssign(
    conversationIds: string[],
    assigneeId: string | null
  ): Promise<BulkActionResponse> {
    return this.execute(conversationIds, 'assign', { assign: assigneeId });
  },

  /**
   * Bulk tag conversations
   */
  async bulkTag(
    conversationIds: string[],
    tagId: string
  ): Promise<BulkActionResponse> {
    return this.execute(conversationIds, 'tag', { tag: tagId });
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
