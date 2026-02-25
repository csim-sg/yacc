/**
 * Message Sent Event
 *
 * Fired when an outbound message is successfully delivered to the platform.
 *
 * @module @yacc/common/types/events/message
 * @see .docs/02-api-and-data-model.md Section 6 - WebSocket Events
 */

import type { BaseEvent } from '../base.event';

/**
 * Payload for message.sent event
 *
 * @example
 * ```json
 * {
 *   "conversationId": "550e8400-e29b-41d4-a716-446655440000",
 *   "messageId": "660e8400-e29b-41d4-a716-446655440000",
 *   "direction": "outbound",
 *   "status": "sent",
 *   "timestamp": "2026-01-16T10:00:00Z"
 * }
 * ```
 */
export interface MessageSentPayload {
  /** UUID of the conversation this message belongs to */
  conversationId: string;
  /** UUID of the sent message */
  messageId: string;
  /** Direction is always outbound for this event */
  direction: 'outbound';
  /** Status confirming successful delivery */
  status: 'sent';
  /** ISO8601 timestamp when the platform confirmed delivery */
  timestamp: string;
}

/**
 * Message Sent Event
 *
 * Emitted when an outbound message is successfully delivered to the external platform.
 * This event is only emitted after the platform confirms successful delivery.
 *
 * @example
 * ```typescript
 * // Type narrowing with discriminated union
 * if (event.event === 'message.sent') {
 *   console.log(`Message ${event.payload.messageId} delivered successfully`);
 *   updateMessageStatus(event.payload.messageId, 'sent');
 * }
 * ```
 */
export type MessageSentEvent = BaseEvent<'message.sent', MessageSentPayload>;
