import type { BulkActionType } from './BulkActionType.type';

/**
 * Bulk Action Entity
 * Represents a bulk operation on multiple conversations
 * Best-effort: partial success is OK (failures returned, not all-or-nothing)
 *
 * @see POST /api/conversations/bulk - BulkActionRequest
 */
export type BulkAction = {
  /** Array of conversation UUIDs to operate on (max 100) */
  conversationIds: string[];
  /** Type of bulk action to perform */
  action: BulkActionType;
  /** Action-specific data (assigneeId, tagId, status, priority) */
  data: Record<string, unknown>;
};
