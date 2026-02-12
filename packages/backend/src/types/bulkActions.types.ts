/**
 * Bulk Actions API Types
 * 
 * Handles bulk operations on conversations:
 * - Bulk assign/reassign to user
 * - Bulk tag (add tag to multiple conversations)
 * - Bulk status update (open/pending/resolved)
 * 
 * Features:
 * - Best-effort: partial success is OK (failures returned, not all-or-nothing)
 * - Max 100 conversations per request
 * - Atomic per-conversation updates (each conversation independently processed)
 * - RBAC: manager+ only
 * - Audit logging: bulk_action_applied for each successful action
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
 * Bulk action response (inner data)
 * 
 * Returns success count, failure count, and detailed failure reasons.
 * Example: { successCount: 98, failureCount: 2, failures: [{id: 'c1', reason: 'Not found'}] }
 */
export interface BulkActionResponseData {
  successCount: number;
  failureCount: number;
  failures: BulkActionFailure[];
}

/**
 * Bulk action response (envelope)
 * 
 * Wraps the bulk action result in a standard data envelope per API contract.
 * Example: { data: { successCount: 98, failureCount: 2, failures: [...] } }
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
