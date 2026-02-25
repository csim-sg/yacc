/**
 * Message Failed Event
 *
 * Fired when an outbound message fails to deliver to the platform.
 * The system will automatically retry with exponential backoff.
 *
 * @module @yacc/common/types/events/message
 * @see .docs/02-api-and-data-model.md Section 6 - WebSocket Events
 */

import type { BaseEvent } from '../base.event';

/**
 * Payload for message.failed event
 *
 * @example
 * ```json
 * {
 *   "conversationId": "550e8400-e29b-41d4-a716-446655440000",
 *   "messageId": "660e8400-e29b-41d4-a716-446655440000",
 *   "error": "Network timeout",
 *   "retryAt": "2026-01-16T10:01:00Z",
 *   "attempt": 1,
 *   "timestamp": "2026-01-16T10:00:00Z"
 * }
 * ```
 */
export interface MessageFailedPayload {
  /** UUID of the conversation this message belongs to */
  conversationId: string;
  /** UUID of the failed message */
  messageId: string;
  /** Human-readable error description */
  error: string;
  /** ISO8601 timestamp of the next automatic retry attempt (null if max retries reached) */
  retryAt: string | null;
  /** Current retry attempt number (1-3) */
  attempt: number;
  /** ISO8601 timestamp when the failure occurred */
  timestamp: string;
}

/**
 * Message Failed Event
 *
 * Emitted when an outbound message fails to deliver to the external platform.
 * The system uses exponential backoff (1m, 5m, 30m) for retries with a max of 3 attempts.
 * After 3 failed attempts, the message moves to the Dead Letter Queue for ops review.
 *
 * @example
 * ```typescript
 * // Type narrowing with discriminated union
 * if (event.event === 'message.failed') {
 *   console.error(`Message ${event.payload.messageId} failed: ${event.payload.error}`);
 *   if (event.payload.attempt < 3) {
 *     console.log(`Will retry at ${event.payload.retryAt}`);
 *   } else {
 *     console.warn('Max retries reached, message moved to DLQ');
 *   }
 * }
 * ```
 */
export type MessageFailedEvent = BaseEvent<
  'message.failed',
  MessageFailedPayload
>;
