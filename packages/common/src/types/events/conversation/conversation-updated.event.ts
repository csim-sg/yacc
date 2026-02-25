/**
 * Conversation Updated Event
 *
 * Fired when conversation status, priority, or assignment changes.
 *
 * @module @yacc/common/types/events/conversation
 * @see .docs/02-api-and-data-model.md Section 6 - WebSocket Events
 */

import type { BaseEvent } from '../base.event';
import type { ConversationStatus } from '../../ConversationStatus.type';
import type { Priority } from '../../Priority.type';

/**
 * Fields that can be updated on a conversation
 *
 * Only includes mutable fields that would trigger this event.
 */
export interface ConversationUpdatedFields {
  /** New conversation status */
  status?: ConversationStatus;
  /** New priority level */
  priority?: Priority;
  /** UUID of newly assigned user (null if unassigned) */
  assignedUserId?: string | null;
  /** New conversation title */
  title?: string;
}

/**
 * Payload for conversation.updated event
 *
 * @example
 * ```json
 * {
 *   "conversationId": "550e8400-e29b-41d4-a716-446655440000",
 *   "updatedFields": {
 *     "status": "pending",
 *     "priority": "high"
 *   },
 *   "changedBy": "770e8400-e29b-41d4-a716-446655440000",
 *   "timestamp": "2026-01-16T10:00:00Z"
 * }
 * ```
 */
export interface ConversationUpdatedPayload {
  /** UUID of the updated conversation */
  conversationId: string;
  /** Map of changed field names and their new values */
  updatedFields: ConversationUpdatedFields;
  /** UUID of the user who made the change (null for system/automation) */
  changedBy: string | null;
  /** ISO8601 timestamp when the change occurred */
  timestamp: string;
}

/**
 * Conversation Updated Event
 *
 * Emitted when a conversation's status, priority, or assignment changes.
 * Frontend should use this to update conversation lists and detail views.
 *
 * @example
 * ```typescript
 * // Type narrowing with discriminated union
 * if (event.event === 'conversation.updated') {
 *   const { conversationId, updatedFields } = event.payload;
 *   if (updatedFields.status) {
 *     updateConversationStatus(conversationId, updatedFields.status);
 *   }
 *   if (updatedFields.assignedUserId !== undefined) {
 *     updateAssignee(conversationId, updatedFields.assignedUserId);
 *   }
 * }
 * ```
 */
export type ConversationUpdatedEvent = BaseEvent<
  'conversation.updated',
  ConversationUpdatedPayload
>;
