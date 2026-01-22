export interface ConnectorMessage {
  id?: string;
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  body: string;
  direction: 'inbound' | 'outbound';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}
