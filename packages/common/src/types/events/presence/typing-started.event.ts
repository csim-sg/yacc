/**
 * Typing Started Event
 *
 * Fired when a user starts typing in a conversation.
 *
 * @module @yacc/common/types/events/presence
 * @see .docs/02-api-and-data-model.md Section 6 - WebSocket Events
 */

import type { BaseEvent } from '../base.event';

/**
 * Payload for typing.started event
 *
 * @example
 * ```json
 * {
 *   "conversationId": "550e8400-e29b-41d4-a716-446655440000",
 *   "userId": "660e8400-e29b-41d4-a716-446655440000",
 *   "userName": "John Doe",
 *   "timestamp": "2026-01-16T10:00:00Z"
 * }
 * ```
 */
export interface TypingStartedPayload {
  /** UUID of the conversation where typing is occurring */
  conversationId: string;
  /** UUID of the user who is typing */
  userId: string;
  /** Display name of the typing user (for UI display) */
  userName?: string;
  /** ISO8601 timestamp when typing started */
  timestamp: string;
}

/**
 * Typing Started Event
 *
 * Emitted when a user starts typing in a conversation.
 * Frontend should show a typing indicator for the specified conversation.
 * Note: This event has a 5-second timeout - if no typing.stopped event
 * is received, the indicator should be hidden automatically.
 *
 * @example
 * ```typescript
 * // Type narrowing with discriminated union
 * if (event.event === 'typing.started') {
 *   const { conversationId, userId, userName } = event.payload;
 *   showTypingIndicator(conversationId, userName || 'Someone');
 *   // Auto-hide after 5 seconds if no typing.stopped received
 *   setTimeout(() => hideTypingIndicator(conversationId), 5000);
 * }
 * ```
 */
export type TypingStartedEvent = BaseEvent<
  'typing.started',
  TypingStartedPayload
>;
