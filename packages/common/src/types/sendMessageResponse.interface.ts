/**
 * Send Message Response Interface
 *
 * Response from sending a message via a connector
 */

export interface SendMessageResponse {
  messageId: string;
  externalMessageId: string;
  status: 'sent' | 'failed';
  error?: string;
  sentAt: Date;
}
