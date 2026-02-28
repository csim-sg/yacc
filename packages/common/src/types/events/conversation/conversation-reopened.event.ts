/**
 * Conversation Reopened Event
 *
 * Fired when a resolved conversation auto-reopens due to a new inbound message.
 *
 * @module @yacc/common/types/events/conversation
 * @see .docs/02-api-and-data-model.md Section 6 - WebSocket Events
 */

import type { BaseEvent } from '../base.event';

/**
 * Reasons why a conversation was reopened
 */
export type ConversationReopenedReason =
  | 'new_inbound_message'
  | 'manual_reopen'
  | 'system_reopen';

/**
 * Minimal conversation summary for the reopened event
 */
export interface ConversationSummary {
  /** UUID of the conversation */
  id: string;
  /** Channel type */
  channel: string;
  /** External thread identifier */
  externalThreadId: string;
  /** Conversation title (if any) */
  title?: string;
  /** Current status (always 'open' after reopen) */
  status: 'open';
}

/**
 * Payload for conversation.reopened event
 *
 * @example
 * ```json
 * {
 *   "conversation": {
 *     "id": "550e8400-e29b-41d4-a716-446655440000",
 *     "channel": "telegram",
 *     "externalThreadId": "tg-123456",
 *     "title": "Customer Support",
 *     "status": "open"
 *   },
 *   "reason": "new_inbound_message",
 *   "reopenedBy": "770e8400-e29b-41d4-a716-446655440000",
 *   "timestamp": "2026-01-16T10:00:00Z"
 * }
 * ```
 */
export interface ConversationReopenedPayload {
  /** Summary of the reopened conversation */
  conversation: ConversationSummary;
  /** Reason why the conversation was reopened */
  reason: ConversationReopenedReason;
  /** UUID of the user who triggered the reopen (null for system/auto-reopen) */
  reopenedBy: string | null;
  /** ISO8601 timestamp when the conversation was reopened */
  timestamp: string;
}

/**
 * Conversation Reopened Event
 *
 * Emitted when a resolved conversation is reopened.
 * This typically happens automatically when a new inbound message arrives
 * for a resolved conversation.
 *
 * @example
 * ```typescript
 * // Type narrowing with discriminated union
 * if (event.event === 'conversation.reopened') {
 *   const { conversation, reason } = event.payload;
 *   console.log(`Conversation ${conversation.id} reopened due to ${reason}`);
 *   moveConversationToOpen(conversation.id);
 * }
 * ```
 */
export type ConversationReopenedEvent = BaseEvent<
  'conversation.reopened',
  ConversationReopenedPayload
>;
