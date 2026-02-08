/**
 * Send Message Request Interface
 *
 * Request to send a message via a connector
 */

export interface SendMessageRequest {
  conversationId: string;
  messageId: string;
  recipientId: string;
  body: string;
  externalThreadId?: string;
  metadata?: Record<string, unknown>;
}
