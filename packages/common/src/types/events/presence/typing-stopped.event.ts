/**
 * Typing Stopped Event
 *
 * Fired when a user stops typing (after 5 second inactivity or explicit stop).
 *
 * @module @yacc/common/types/events/presence
 * @see .docs/02-api-and-data-model.md Section 6 - WebSocket Events
 */

import type { BaseEvent } from '../base.event';

/**
 * Payload for typing.stopped event
 *
 * @example
 * ```json
 * {
 *   "conversationId": "550e8400-e29b-41d4-a716-446655440000",
 *   "userId": "660e8400-e29b-41d4-a716-446655440000",
 *   "timestamp": "2026-01-16T10:00:00Z"
 * }
 * ```
 */
export interface TypingStoppedPayload {
  /** UUID of the conversation where typing stopped */
  conversationId: string;
  /** UUID of the user who stopped typing */
  userId: string;
  /** ISO8601 timestamp when typing stopped */
  timestamp: string;
}

/**
 * Typing Stopped Event
 *
 * Emitted when a user stops typing in a conversation.
 * This can happen after 5 seconds of inactivity or when the user
 * explicitly cancels typing (e.g., navigates away).
 *
 * @example
 * ```typescript
 * // Type narrowing with discriminated union
 * if (event.event === 'typing.stopped') {
 *   const { conversationId, userId } = event.payload;
 *   hideTypingIndicator(conversationId, userId);
 * }
 * ```
 */
export type TypingStoppedEvent = BaseEvent<
  'typing.stopped',
  TypingStoppedPayload
>;
