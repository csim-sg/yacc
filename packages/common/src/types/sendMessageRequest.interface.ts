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
  platformType?: 'telegram' | 'irc' | 'whatsapp' | 'weChat' | 'meta' | 'twitter';
  correlationId?: string; // Request correlation ID for end-to-end tracing
}
