/**
 * Bulk Actions API Types
 * Backend-specific types for bulk operations on conversations
 *
 * For shared types, use:
 * - BulkAction from '@yacc/common/types/BulkAction.type'
 * - BulkActionResponse from '@yacc/common/responses/conversations/bulkAction.response'
 * - BulkActionRequest from '@yacc/common/requests/conversations/bulkAction.request'
 *
 * Features:
 * - Best-effort: partial success is OK (failures returned, not all-or-nothing)
 * - Max 100 conversations per request
 * - Atomic per-conversation updates (each conversation independently processed)
 * - RBAC: manager+ only
 * - Audit logging: bulk_action_applied for each successful action
 */

import type { BulkActionType } from '@yacc/common/types/BulkActionType.type';

/**
 * Conversation status type (local definition for consistency)
 */
export type ConversationStatus = 'open' | 'pending' | 'resolved';

/**
 * Bulk action request body
 * @deprecated Use BulkActionRequest from '@yacc/common/requests/conversations/bulkAction.request'
 */
export interface BulkActionRequest {
  conversationIds: string[];
  action: BulkActionType;
  data: Record<string, unknown>;
}

/**
 * Bulk action failure details
 */
export interface BulkActionFailure {
  id: string;
  reason: string;
}

/**
 * Bulk action response (inner data)
 *
 * Returns success count, failure count, and detailed failure reasons.
 */
export interface BulkActionResponseData {
  successCount: number;
  failureCount: number;
  failures: BulkActionFailure[];
}

/**
 * Bulk action response (envelope)
 */
export interface BulkActionResponse {
  data: BulkActionResponseData;
}

/**
 * Type guard for conversation status
 */
export function isValidStatus(status: unknown): status is ConversationStatus {
  return status === 'open' || status === 'pending' || status === 'resolved';
}

/**
 * Type guard for bulk action type
 */
export function isValidActionType(action: unknown): action is BulkActionType {
  return action === 'assign' || action === 'tag' || action === 'status';
}
