/**
 * Message Payloads
 *
 * WebSocket event payload types for message-related events
 */

/**
 * Payload for message.received event
 */
export interface MessageReceivedPayload {
  messageId: string;
  conversationId: string;
  senderName: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
}

/**
 * Payload for message.sent event
 */
export interface MessageSentPayload {
  messageId: string;
  conversationId: string;
  status: 'sent';
  sentAt: string;
}

/**
 * Payload for message.failed event
 */
export interface MessageFailedPayload {
  messageId: string;
  conversationId: string;
  status: 'failed';
  error: string;
  failedAt: string;
  attemptNumber: number;
}
