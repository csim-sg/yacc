/**
 * Message Payload Types
 *
 * Type definitions for message-related WebSocket event payloads
 *
 * @module @yacc/common/websocket/types
 */

/** Attachment in a message */
export interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
}

/** Error details for failed messages */
export interface MessageError {
  code: string;
  message: string;
}

/**
 * Message payload for WebSocket events
 *
 * Used for:
 * - message.received: New inbound message
 * - message.sent: Outbound message confirmed
 * - message.failed: Outbound message failed
 */
export interface MessagePayload {
  /** Unique message identifier */
  id: string;

  /** Conversation this message belongs to */
  conversationId: string;

  /** ID of the sender */
  senderId: string;

  /** Display name of the sender */
  senderName: string;

  /** Message body text */
  body: string;

  /** Current message status */
  status: 'pending' | 'sent' | 'failed';

  /** Message direction */
  direction: 'inbound' | 'outbound';

  /** ISO 8601 timestamp when message was created */
  createdAt: string;

  /** Optional attachments */
  attachments?: MessageAttachment[];

  /** Error details if status is 'failed' */
  error?: MessageError;
}
