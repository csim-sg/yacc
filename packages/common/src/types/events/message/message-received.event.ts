/**
 * Message Received Event
 *
 * Fired when a new inbound message arrives from Telegram or IRC.
 *
 * @module @yacc/common/types/events/message
 * @see .docs/02-api-and-data-model.md Section 6 - WebSocket Events
 */

import type { BaseEvent } from '../base.event';
import type { Attachment } from '../../attachment.interface';

/**
 * Payload for message.received event
 *
 * @example
 * ```json
 * {
 *   "conversationId": "550e8400-e29b-41d4-a716-446655440000",
 *   "messageId": "660e8400-e29b-41d4-a716-446655440000",
 *   "platform": "telegram",
 *   "senderId": "123456789",
 *   "senderName": "John Doe",
 *   "body": "Hello, I have a question about my order.",
 *   "direction": "inbound",
 *   "timestamp": "2026-01-16T10:00:00Z",
 *   "attachments": [
 *     { "url": "https://cdn.example.com/image.jpg", "type": "image", "name": "file.jpg" }
 *   ]
 * }
 * ```
 */
export interface MessageReceivedPayload {
  /** UUID of the conversation this message belongs to */
  conversationId: string;
  /** UUID of the newly created message */
  messageId: string;
  /** Platform the message originated from */
  platform: 'telegram' | 'irc';
  /** External sender ID from the platform */
  senderId: string;
  /** Display name of the sender */
  senderName: string;
  /** Message body text */
  body: string;
  /** Direction is always inbound for this event */
  direction: 'inbound';
  /** ISO8601 timestamp when the message was received */
  timestamp: string;
  /** Optional array of attachments (images, files, etc.) */
  attachments?: Attachment[];
}

/**
 * Message Received Event
 *
 * Emitted when a new inbound message arrives from Telegram or IRC.
 * Frontend should use this to update conversation lists and message views.
 *
 * @example
 * ```typescript
 * // Type narrowing with discriminated union
 * if (event.event === 'message.received') {
 *   console.log(`New message from ${event.payload.senderName}: ${event.payload.body}`);
 * }
 * ```
 */
export type MessageReceivedEvent = BaseEvent<
  'message.received',
  MessageReceivedPayload
>;
