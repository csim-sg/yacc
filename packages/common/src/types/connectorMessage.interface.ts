/**
 * Connector Message Interface
 *
 * Message from an external platform connector
 */

export interface ConnectorMessage {
  messageId: string;
  conversationId: string;
  threadId?: string;
  sender: {
    id: string;
    name?: string;
  };
  body: string;
  attachments?: Array<{
    url: string;
    type: string;
    name?: string;
  }>;
  createdAt: Date;
}
