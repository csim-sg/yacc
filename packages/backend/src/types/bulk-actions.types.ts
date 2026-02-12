/**
 * Bulk Actions API Types
 * 
 * Handles bulk operations on conversations:
 * - Bulk assign/reassign to user
 * - Bulk tag (add tag to multiple conversations)
 * - Bulk status update (open/pending/resolved)
 * 
 * Features:
 * - Best-effort: partial success is OK (not all-or-nothing)
 * - Max 100 conversations per request
 * - Transaction-per-conversation for safety
 * - RBAC: manager+ only
 * - Audit logging: bulk_action_applied
 */

export type BulkActionType = 'assign' | 'tag' | 'status';

export type ConversationStatus = 'open' | 'pending' | 'resolved';

/**
 * Bulk action request body
 * 
 * Examples:
 * - Assign: { conversationIds: ['c1', 'c2'], action: 'assign', data: { assigneeId: 'u123' } }
 * - Tag: { conversationIds: ['c1', 'c2'], action: 'tag', data: { tagId: 't456' } }
 * - Status: { conversationIds: ['c1', 'c2'], action: 'status', data: { status: 'resolved' } }
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
 * Bulk action response
 * 
 * Returns success count, failure count, and detailed failure reasons.
 * Example: { successCount: 98, failureCount: 2, failures: [{id: 'c1', reason: 'Not found'}] }
 */
export interface BulkActionResponse {
  successCount: number;
  failureCount: number;
  failures: BulkActionFailure[];
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
